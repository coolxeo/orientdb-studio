var Widget = angular.module('rendering', []);


Widget.directive('docwidget', function ($compile, $http, Database, CommandApi, DocumentApi) {


    var compileForm = function (response, scope, element, attrs) {
        var formScope = scope.$new(true);
        formScope.doc = scope.doc;
        formScope.database = scope.database;
        formScope.deleteField = scope.deleteField;
        formScope.options = new Array;
        formScope.types = Database.getSupportedTypes();
        formScope.fieldTypes = new Array;
        formScope.editorOptions = {
            lineWrapping: true,
            lineNumbers: true,
            readOnly: false,
            mode: 'application/json',
            onChange: function (_editor) {

            }
        };
        formScope.onLoadEditor = function (_editor) {
            console.log(_editor);
        }
        formScope.inSchema = function (header) {
            var property = Database.listPropertyForClass(scope.doc['@class'], header);
            return property;
        }
        formScope.isSelected = function (name, type) {
            return type == formScope.getType(name);
        }
        formScope.getTemplate = function (header) {
            if (formScope.doc['@class']) {
                var type = findType(formScope, header);
                if (type) {
                    return 'views/widget/' + type.toLowerCase() + '.html';
                }
                else {
                    return 'views/widget/string.html';
                }
            }
        }
        formScope.getType = function (header) {
            if (formScope.doc['@class']) {
                return findType(formScope, header);
            } else {
                return "STRING";
            }
        }
        formScope.requiredString = function (header) {
            return formScope.isRequired(header) ? "*" : "";
        }
        formScope.isRequired = function (header) {

            var property = Database.listPropertyForClass(formScope.doc['@class'], header);
            if (property) {
                return property.mandatory;
            } else {
                return false;
            }
        }
        formScope.findAll = function (header) {
            var property = Database.listPropertyForClass(formScope.doc['@class'], header);
            if (!formScope.options[header]) {
                CommandApi.getAll(scope.database, property.linkedClass, function (data) {
                    formScope.options[header] = data.result;
                });
            }
        }
        formScope.changeType = function (name, type) {
            formScope.$apply(function () {
                var idx = formScope.headers.indexOf(name);
                formScope.headers.splice(idx, 1);

                var types = formScope.doc['@fieldTypes'];
                if (types) {
                    types = types + ',' + name + '=' + Database.getMappingFor(type);
                } else {
                    types = name + '=' + Database.getMappingFor(type);
                }
                formScope.doc['@fieldTypes'] = types
                formScope.headers.push(name);
            });

        }
        formScope.$watch('formID.$valid', function (validity) {
            scope.docValid = validity;
        });
        formScope.handleFile = function (header, files) {

            var reader = new FileReader();
            reader.onload = function (event) {
                object = {};
                object.filename = files[0].name;
                object.data = event.target.result;
                var blobInput = [event.target.result];
                var blob = new Blob(blobInput);
                formScope.doc[header] = "$file";
                DocumentApi.uploadFileDocument(formScope.database, formScope.doc, blob, files[0].name);
            }
            reader.readAsDataURL(files[0]);
        }
        scope.$on('fieldAdded', function (event, field) {
            formScope.fieldTypes[field] = formScope.getTemplate(field);
        });
        scope.$parent.$watch("headers", function (data) {
            if (data) {
                data.forEach(function (elem, idx, array) {
                    formScope.fieldTypes[elem] = formScope.getTemplate(elem);
                });
                formScope.headers = data;
            }

        });
        var el = angular.element($compile(response.data)(formScope));
        element.empty();
        element.append(el);
    }
    var findType = function (scope, name) {
        var type = null;
        var property = Database.listPropertyForClass(scope.doc['@class'], name);


        var guessType = function (value) {
            var value = scope.doc[name];
            var type = null;
            if (typeof value === 'number') {
                type = "INTEGER";
            } else if (typeof value === 'boolean') {
                type = "BOOLEAN";
            }
            return type;
        }
        if (!property) {
            var fieldTypes = scope.doc['@fieldTypes'];
            var type = Database.findTypeFromFieldTipes(scope.doc, name);
            if (!type)
                type = guessType(scope.doc[name])
            property = new Object;
            property.name = name;
        } else {
            type = property.type;
        }
        return type != null ? type : "STRING";
    }
    var linker = function (scope, element, attrs) {
        $http.get('views/widget/form.html').then(function (response) {
            compileForm(response, scope, element, attrs);
        });
    }
    return {
        // A = attribute, E = Element, C = Class and M = HTML Comment
        restrict: 'A',
        //The link function is responsible for registering DOM listeners as well as updating the DOM.
        link: linker
    }
});

Widget.directive('jsontext', function () {

    var formatter = (function () {

        function repeat(s, count) {
            return new Array(count + 1).join(s);
        }

        function formatJson(json, indentChars) {
            var i = 0,
                il = 0,
                tab = (typeof indentChars !== "undefined") ? indentChars : "    ",
                newJson = "",
                indentLevel = 0,
                inString = false,
                currentChar = null;

            for (i = 0, il = json.length; i < il; i += 1) {
                currentChar = json.charAt(i);

                switch (currentChar) {
                    case '{':
                    case '[':
                        if (!inString) {
                            newJson += currentChar + "\n" + repeat(tab, indentLevel + 1);
                            indentLevel += 1;
                        } else {
                            newJson += currentChar;
                        }
                        break;
                    case '}':
                    case ']':
                        if (!inString) {
                            indentLevel -= 1;
                            newJson += "\n" + repeat(tab, indentLevel) + currentChar;
                        } else {
                            newJson += currentChar;
                        }
                        break;
                    case ',':
                        if (!inString) {
                            newJson += ",\n" + repeat(tab, indentLevel);
                        } else {
                            newJson += currentChar;
                        }
                        break;
                    case ':':
                        if (!inString) {
                            newJson += ": ";
                        } else {
                            newJson += currentChar;
                        }
                        break;
                    case ' ':
                    case "\n":
                    case "\t":
                        if (inString) {
                            newJson += currentChar;
                        }
                        break;
                    case '"':
                        if (i > 0 && json.charAt(i - 1) !== '\\') {
                            inString = !inString;
                        }
                        newJson += currentChar;
                        break;
                    default:
                        newJson += currentChar;
                        break;
                }
            }

            return newJson;
        }

        return { "formatJson": formatJson };

    }());

    return {
        restrict: 'A',
        require: 'ngModel',
        link: function (scope, element, attr, ngModel) {
            function into(input) {
                if (input) return JSON.parse(input);

                return input;
            }

            function out(data) {
                if (data) {
                    var string = data instanceof Object ? JSON.stringify(data) : data;
                    return formatter.formatJson(string);
                }
            }

            ngModel.$parsers.push(into);
            ngModel.$formatters.push(out);

        }
    };
});

Widget.directive('chartjs', function () {


    return {
        restrict: 'A',
        link: function (scope, element, attr) {

            var data = scope.$eval(attr.chartjs);
            new Chart(element.get(0).getContext("2d")).Pie(data, {segmentShowStroke: false});

        }
    };
});
Widget.directive('orientdate', function (Database) {


    return {
        restrict: 'A',
        require: 'ngModel',
        link: function (scope, element, attr, ngModel) {

            function into(input) {

                var values = Database.getMetadata()['config']['values'];
                var formatter = undefined;
                values.forEach(function (val, idx, array) {
                    if (val.name == 'dateFormat') {
                        formatter = val.value;
                    }
                });
                var form = input;
                if (input) {
                    var form = moment(input, 'DD/MM/YYYY').format(formatter.toUpperCase());
                }
                console.log(form);
                return form;
            }

            function out(data) {
                var form = data
                if (data) {
                    form = moment(data).format('DD/MM/YYYY');
                }
                return form;
            }

            ngModel.$parsers.push(into);
            ngModel.$formatters.push(out);


        }
    };
});
Widget.directive('orientdatetime', function (Database) {


    return {
        restrict: 'A',
        require: 'ngModel',
        link: function (scope, element, attr, ngModel) {

            function into(input) {

                var values = Database.getMetadata()['config']['values'];
                var formatter = undefined;
                values.forEach(function (val, idx, array) {
                    if (val.name == 'dateTimeFormat') {
                        formatter = val.value;
                    }
                });
                var form = input;

                console.log(input);
                if (input) {
                    var form = moment(input).format(formatter.toUpperCase());
                }
                return form;
            }

            function out(data) {
                var form = data

                if (data) {
                    form = moment(data).format('DD/MM/YYYY HH:mm:ss');
                }
                return form;
            }

            ngModel.$parsers.push(into);
            ngModel.$formatters.push(out);


        }
    };
});
Widget.directive('ridrender', function (Database) {


    return {
        restrict: 'A',
        link: function (scope, element, attr, ngModel) {

            var value = scope.result[scope.header];
            if (typeof value == 'string') {
                if (value.indexOf('#') == 0) {
                    var dbName = Database.getName();
                    var link = '<a href="#/database/' + dbName + '/browse/edit/' + value.replace('#', '') + '">' + value + '</a>';
                    element.html(link);
                }
            }
        }
    };
});
Widget.directive('dtpicker', function () {


    return {
        restrict: 'A',
        require: 'ngModel',
        link: function (scope, element, attr, ngModel) {

            element.datetimepicker({
                format: 'dd/MM/yyyy hh:mm:ss',
                language: 'en'
            });
            element.on('changeDate', function (e) {
                ngModel.$setViewValue(e.date);
            });
        }
    };
});
Widget.directive('collaterender', function () {


    return {
        restrict: 'A',
        link: function (scope, element, attr, ngModel) {

            var value = scope.result['collate'];
            if (value == 'ci') {
                scope.result['collate'] = 'Case Insensitive';
            }
        }
    };
});
