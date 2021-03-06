var revall = require("./index");
var toolFactory = require("./tool");
var should = require("should");
var gulp = require("gulp");
var es = require("event-stream");
var fs = require("fs");
var util = require("util");
var Stream = require("stream");
var assert = require("assert");
var path = require('path');
var gutil = require("gulp-util");
var glob = require("glob");
var sinon = require("sinon");
 
require("mocha");

describe("gulp-rev-all", function () {

    var tool;
    var stream;
    var base = path.join(__dirname, 'test/fixtures/config1');
    var writeFile = function(globPath) {
        glob(globPath, {}, function (er, fileNames) {
            fileNames.forEach(function (fileName) {
                stream.write(new gutil.File({
                    path: path.resolve(fileName),
                    contents: fs.readFileSync(fileName),
                    base: base
                }));
            });

            stream.end();
        });
    };
    var getFile = function (filePath) {
        return new gutil.File({
            path: path.join(__dirname, filePath),
            contents: fs.readFileSync(filePath),
            base: base
        });
    };

    describe('resource hash calculation', function() {

        it('should change if child reference changes', function(done) {

            tool = toolFactory({hashLength: 8, ignore: ['favicon.ico'], dirRoot: path.join(__dirname, 'test/fixtures/config1') });
            var fileStyleBaseline = tool.revisionFile(getFile('test/fixtures/config1/css/style.css'));

            var fsMock = {
                existsSync: function() {},
                readFileSync: function() {}
            };

            var existsSyncStub = sinon.stub(fsMock, "existsSync");
            var readFileSyncStub = sinon.stub(fsMock, "readFileSync");

            existsSyncStub.returns(true);
            readFileSyncStub.returns(new Buffer('dummy'));

            stream = revall({ fs: fsMock });
            stream.on('data', function (file) {

                file.path.should.not.equal(fileStyleBaseline.path);

            });

            stream.on('end', function () {
                done();
            })

            writeFile('test/fixtures/config1/css/style.css');
        });

    });

    describe('should process images', function() {

        beforeEach(function (done) {
            stream = revall();
            done();
        });

        var filename = path.join(base, 'img/image1.jpg');
        it('without corrupting them', function(done) {
            stream.on('data', function (file) {
                file.contents[0].should.equal(255);
                file.contents[1].should.equal(216);
                file.contents[2].should.equal(255);
                file.contents[3].should.equal(224);
                done();
            });

            writeFile(filename);
        });
    })

    describe('Root directory', function() {

        it('should be detected properly', function(done) {

            var options = {hashLength: 4, ignore: []};
            stream = revall(options);
            stream.on('data', function (file) {
            });

            stream.on('end', function () {
                options.dirRoot.should.match(/test\/fixtures\/config1$/);
                done();
            });
            writeFile('test/fixtures/config1/**/*.*');
        });

        it('should be trim trailing slash on windows', function(done) {

            var options = {hashLength: 4, ignore: [], dirRoot: 'C:\\web\\project\\'};
            stream = revall(options);
            stream.on('data', function (file) {
            });

            stream.on('end', function () {
                options.dirRoot.should.match(/C:\\web\\project$/);
                done();
            });
            writeFile('test/fixtures/config1/**/*.*');
        });

    });        


    describe('options:', function() {


        describe('filename', function() {

            it('should have proper hash length when specified', function(done) {

                stream = revall({hashLength: 4, ignore: []});
                stream.on('data', function (file) {
                    path.basename(file.path).should.match(/\.[a-z0-9]{4}\.[a-z]{2,4}$/);
                });

                stream.on('end', done);
                writeFile('test/fixtures/config1/**/*.*');
            });

            it('should be transformed when transform function is specified', function(done) {

                stream = revall({
                    ignore: [],
                    transformFilename: function (file, hash) {
                        var ext = path.extname(file.path);
                        return hash.slice(0, 5) + '.'  + path.basename(file.path, ext) + ext; // 3410c.filename.ext
                    }
                });

                stream.on('data', function (file) {
                    path.basename(file.path).should.match(/[a-z0-9]{5}\..*\.[a-z]{2,4}$/);
                });

                stream.on('end', done);
                writeFile('test/fixtures/config1/**/*.*');
            });

        });


        describe('ignore', function() {


            it('should not rename favicon.ico by default', function (done) {

                stream = revall();
                stream.on('data', function (file) {
                    path.basename(file.path).should.not.match(/favicon\.[a-z0-9]{8}\.ico$/);
                });

                stream.on('end', done);

                writeFile('test/fixtures/config1/**/*.*');
            });

            it('should rename nested index', function (done) {

                stream = revall({ ignore: [ /^\/index.html/g ] });
                stream.on('data', function (file) {
                    file.path.should.not.match(/nested\/index\.html$/);
                    file.path.should.not.match(/config1\/index\.[a-z0-9]{8}\.html$/);
                });

                stream.on('end', done);

                writeFile('test/fixtures/config1/**/*.*');
            });

            it('should not rename html files when specified', function (done) {

                stream = revall({ ignore: ['.html'] });
                stream.on('data', function (file) {
                    path.basename(file.path).should.not.match(/\.[a-z0-9]{8}\.html$/);
                });

                stream.on('end', done);

                writeFile('test/fixtures/config1/**/*.*');
            });

            it('should still process and re-write references in a ignored file', function (done) {

                stream = revall({ ignore: ['.html'] });
                stream.on('data', function (file) {
                    var contents = new String(file.contents);
                    contents.should.match(/\"[a-z0-9]*\.[a-z0-9]{8}\.[a-z]{2,4}\"/);
                });

                stream.on('end', done);

                writeFile('test/fixtures/config1/index.html');
            });

            it('should not rename reference if that reference is ignored', function (done) {

                stream = revall({ ignore: ['.js'] });
                stream.on('data', function (file) {
                    var contents = new String(file.contents);
                    contents.should.match(/\"[a-z0-9]*\.js\"/);
                });

                stream.on('end', done);

                writeFile('test/fixtures/config1/index.html');
            });




            it('should not rename js files when specified', function (done) {

                stream = revall({ ignore: ['.js'] });
                stream.on('data', function (file) {
                    path.basename(file.path).should.not.match(/\.[a-z0-9]{8}\.js$/);
                });
                stream.on('end', done);

                writeFile('test/fixtures/config1/**/*.*');
            });


            it('should not rename woff files when specified', function (done) {

                stream = revall({ ignore: ['.woff'] });
                stream.on('data', function (file) {
                    path.basename(file.path).should.not.match(/\.[a-z0-9]{8}\.woff$/);
                });
                stream.on('end', done);

                writeFile('test/fixtures/config1/**/*.*');
            });


            it('should rename all files when ignore not specified', function (done) {

                stream = revall();
                stream.on('data', function (file) {
                    path.basename(file.path).should.match(/(\.[a-z0-9]{8}\.[a-z]{2,4}$|favicon\.ico$)/);
                });
                stream.on('end', done);

                writeFile('test/fixtures/config1/**/*.*');
            });
        });

    });

    describe("root html", function() {

        beforeEach(function (done) {
            tool = toolFactory({hashLength: 8, ignore: ['favicon.ico'], dirRoot: path.join(__dirname, 'test/fixtures/config1') });
            stream = revall()
            done()
        });

        it("should resolve absolute path reference", function(done) {

            stream.on('data', function (file) {
                String(file.contents).should.match(/'\/index\.[a-z0-9]{8}\.html'/);
                done();
            });

            writeFile( path.join(base, 'index.html') );
        });

        it("should prefix replaced references if a prefix is supplied", function(done) {

            stream = revall({
                prefix: 'http://example.com/'
            });

            stream.on('data', function (file) {
                String(file.contents).should.match(/'http:\/\/example\.com\/index\.[a-z0-9]{8}\.html'/);
                done();
            });

            writeFile( path.join(base, 'index.html') );
        });

        it("should replaced references using transform if it is supplied", function(done) {

            stream = revall({
                transformPath: function (reved, source, path) {
                    return this.joinPathUrl('//images.example.com/', reved.replace('img/', ''));
                }
            });

            stream.on('data', function (file) { 
                var revedReference = path.basename(tool.revisionFile(getFile('test/fixtures/config1/css/style.css')).path);
                String(file.contents).should.containEql(revedReference);
                done();
            });

            writeFile( path.join(base, 'index.html') );
        });

        it("should resolve reference to css", function(done) {

            stream.on('data', function (file) {
                var revedReference = path.basename(tool.revisionFile(getFile('test/fixtures/config1/css/style.css')).path);
                String(file.contents).should.containEql(revedReference);
                done();
            });

            writeFile( path.join(base, 'index.html') );
        });

        it("should resolve reference reference to angularjs view", function(done) {

            stream.on('data', function (file) {
                var revedReference = path.basename(tool.revisionFile(getFile('test/fixtures/config1/view/main.html')).path);
                String(file.contents).should.containEql(revedReference);
                done();
            });

            writeFile( path.join(base, 'index.html') );
        });


        it("should resolve reference reference to javascript include", function(done) {

            stream.on('data', function (file) {
                var revedReference = path.basename(tool.revisionFile(getFile('test/fixtures/config1/application.js')).path);
                String(file.contents).should.containEql(revedReference);
                done();
            });

            writeFile( path.join(base, 'index.html') );
        });


        it("should resolve reference in double quotes", function(done) {

            stream.on('data', function (file) {
                var revedReference = path.basename(tool.revisionFile(getFile('test/fixtures/config1/img/image1.jpg')).path);
                String(file.contents).should.containEql(revedReference);
                done();
            });

            writeFile( path.join(base, 'index.html') );
        });

        it("should resolve reference in single quotes", function(done) {

            stream.on('data', function (file) {
                var revedReference = path.basename(tool.revisionFile(getFile('test/fixtures/config1/img/image2.jpg')).path);
                String(file.contents).should.containEql(revedReference);
                done();
            });

            writeFile( path.join(base, 'index.html') );
        });

        it("should replace all references", function(done) {

            stream.on('data', function (file) {
                var revedReference = path.basename(tool.revisionFile(getFile('test/fixtures/config1/img/image3.jpg')).path);
                var count = String(file.contents).match(RegExp(revedReference, 'g'));
                count.length.should.eql(2);
                done();
            });

            writeFile( path.join(base, 'index.html') );
        });

    });

    describe("angularjs view", function() {

        beforeEach(function (done) {
            tool = toolFactory({hashLength: 8, ignore: ['favicon.ico'], dirRoot: path.join(__dirname, 'test/fixtures/config1') });
            stream = revall();
            done();
        });
        
        var filename = path.join(base, 'view/main.html');
        var writeFile = function() {
            stream.write(new gutil.File({
                path: filename,
                contents: fs.readFileSync(filename),
                base: base
            }));
        }

        it("should resolve references to images", function(done) {

            stream.on('data', function (file) {
                var revedReference = path.basename(tool.revisionFile(getFile('test/fixtures/config1/img/image1.jpg')).path);
                String(file.contents).should.containEql(revedReference);
                done();
            });

            writeFile();
        });

        it("should resolve references to angular includes", function(done) {

            stream.on('data', function (file) {
                var revedReference = path.basename(tool.revisionFile(getFile('test/fixtures/config1/view/core/footer.html')).path);
                String(file.contents).should.containEql(revedReference);
                done();
            });

            writeFile();
        });

    });

    describe("css", function() {

        beforeEach(function (done) {
            tool = toolFactory({hashLength: 8, ignore: ['favicon.ico'], dirRoot: path.join(__dirname, 'test/fixtures/config1') });
            stream = revall()
            done();
        });

        var base = path.join(__dirname, 'test/fixtures/config1');
        var filename = path.join(base, 'css/style.css');
        var writeFile = function() {
            stream.write(new gutil.File({
                path: filename,
                contents: fs.readFileSync(filename),
                base: base
            }));
        }

        it("should resolve references to fonts", function (done) {

            stream.on('data', function (file) {
                var revedReference1 = path.basename(tool.revisionFile(getFile('test/fixtures/config1/font/font1.eot')).path);
                String(file.contents).should.containEql(revedReference1);

                var revedReference2 = path.basename(tool.revisionFile(getFile('test/fixtures/config1/font/font1.woff')).path);
                String(file.contents).should.containEql(revedReference2);

                var revedReference3 = path.basename(tool.revisionFile(getFile('test/fixtures/config1/font/font1.ttf')).path);
                String(file.contents).should.containEql(revedReference3);

                var revedReference4 = path.basename(tool.revisionFile(getFile('test/fixtures/config1/font/font1.svg')).path);
                String(file.contents).should.containEql(revedReference4);

                done();
            });

            writeFile();

        });

        it("should resolve references to images", function (done) {

            stream.on('data', function (file) {

                var revedReference = path.basename(tool.revisionFile(getFile('test/fixtures/config1/img/image1.jpg')).path);
                String(file.contents).should.containEql(revedReference);

                var revedReference = path.basename(tool.revisionFile(getFile('test/fixtures/config1/img/image2.jpg')).path);
                String(file.contents).should.containEql(revedReference);

                done();
            });

            writeFile();
        });


    });

    describe("main js", function() {

        beforeEach(function (done) {
            tool = toolFactory({ hashLength: 8, ignore: ['favicon.ico'], dirRoot: path.join(__dirname, 'test/fixtures/config1') });
            stream = revall();
            done();
        });

        it("should not resolve arbitrarty text with the same name as a file", function(done) {

            stream.on('data', function (file) {

                var revedReference = path.basename(tool.revisionFile(getFile('test/fixtures/config1/short.js')).path);
                String(file.contents).should.not.containEql('var ' + revedReference);

                done();
            });

            writeFile(path.join(base, 'application.js'));

        });

        it("should resolve references to regular commonjs include", function(done) {

            stream.on('data', function (file) {

                var revedReference = path.basename(tool.revisionFile(getFile('test/fixtures/config1/layout.js')).path);
                String(file.contents).should.containEql(revedReference);
                String(file.contents).should.containEql('./');

                done();
            });

            writeFile(path.join(base, 'application.js'));

        });

        it("should resolve references to short style commonjs include", function(done) {

            stream.on('data', function (file) {

                var revedReference = path.basename(tool.revisionFile(getFile('test/fixtures/config1/short.js')).path);
                String(file.contents).should.containEql(revedReference);
                String(file.contents).should.containEql('./');

                done();
            });

            writeFile(path.join(base, 'application.js'));

        });

    
        it("should resolve references to angularjs views", function(done) {

            stream.on('data', function (file) {

                var revedReference = path.basename(tool.revisionFile(getFile('test/fixtures/config1/view/gps.html')).path);
                String(file.contents).should.containEql(revedReference);

                done();
            });

            writeFile(path.join(base, 'application.js'));

        });

        it("should resolve references to compiled templates", function(done) {

            stream.on('data', function (file) {

                var revedReference = path.basename(tool.revisionFile(getFile('test/fixtures/config1/img/image1.jpg')).path);
                String(file.contents).should.containEql(revedReference);

                done();
            });

            writeFile(path.join(base, 'application.js'));

        });

    });


    describe('tool', function() {

        describe('joinPath', function() {

            it("should correct windows style slashes", function() {

                var pathMock = {
                    join: function() {}
                };
                var joinStub = sinon.stub(pathMock, "join");
                joinStub.returns('\\long\\widows\\path\\images.png');

                var tool = toolFactory({ dirRoot: path.join(__dirname, 'test/fixtures/config1'), path: pathMock });
                tool.joinPath().should.equal('/long/widows/path/images.png');

            });

        });

        describe('isFileIgnored', function() {

            it("should correct windows style slashes", function() {

                var tool = toolFactory({ ignore: [ /^\/favicon.ico$/g ], dirRoot: path.join(__dirname, 'test/fixtures/config1') });
                tool.isFileIgnored(path.join(__dirname, 'test/fixtures/config1/favicon.ico').replace(/\//g, '\\')).should.be.true;

            });

        });

    });

});
