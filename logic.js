"use strict";
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GradleToKtsConverter = void 0;
var GradleToKtsConverter = /** @class */ (function () {
    function GradleToKtsConverter() {
        this.conversionFunctions = [
            this.replaceApostrophes,
            this.replaceDefWithVal,
            this.convertMapExpression,
            this.convertFileTree,
            this.convertArrayExpression,
            this.convertManifestPlaceHoldersWithMap,
            this.convertVariableDeclaration,
            this.convertPlugins,
            this.convertPluginsIntoOneBlock,
            this.convertPluginsFrom,
            this.convertVariantFilter,
            this.convertAndroidBuildConfigFunctions,
            this.convertCompileToImplementation,
            this.replaceCoreLibraryDesugaringEnabled,
            this.convertDependencies,
            this.convertMaven,
            this.addParentheses,
            this.addEquals,
            this.convertJavaCompatibility,
            this.convertCleanTask,
            this.convertProguardFiles,
            this.convertInternalBlocks,
            this.convertInclude,
            this.convertBuildTypes,
            this.convertProductFlavors,
            this.convertSourceSets,
            this.convertSigningConfigs,
            this.convertExcludeClasspath,
            this.convertExcludeModules,
            this.convertExcludeGroups,
            this.convertJetBrainsKotlin,
            this.convertSigningConfigBuildType,
            this.convertExtToExtra,
            this.addParenthesisToId,
            this.replaceColonWithEquals,
            this.convertBuildFeatures,
        ];
    }
    GradleToKtsConverter.prototype.convert = function (input) {
        var _this = this;
        return this.conversionFunctions.reduce(function (text, fn) { return fn.call(_this, text); }, input);
    };
    GradleToKtsConverter.prototype.replaceAll = function (str, find, replace) {
        return str.replace(new RegExp(find, "g"), replace);
    };
    GradleToKtsConverter.prototype.replaceWithCallback = function (str, regex, callback) {
        return str.replace(regex, function (match) {
            var args = [];
            for (var _i = 1; _i < arguments.length; _i++) {
                args[_i - 1] = arguments[_i];
            }
            return callback(__spreadArray([match], args, true));
        });
    };
    GradleToKtsConverter.prototype.replaceApostrophes = function (text) {
        return this.replaceAll(text, "'", '"');
    };
    GradleToKtsConverter.prototype.replaceDefWithVal = function (text) {
        return text.replace(/(^|\s)def\s+/g, "$1val ");
    };
    GradleToKtsConverter.prototype.convertMapExpression = function (text) {
        var mapRegExp = /\[(\s*\w+:\s*[^,:\s\]]+\s*(?:,\s*\w+:\s*[^,:\s\]]+\s*)*)\]/g;
        return this.replaceWithCallback(text, mapRegExp, function (match) {
            var entries = match[1].split(",").map(function (entry) {
                var _a = entry.split(":").map(function (s) { return s.trim(); }), key = _a[0], value = _a[1];
                return "\"".concat(key, "\" to ").concat(value);
            });
            return "mapOf(".concat(entries.join(", "), ")");
        });
    };
    GradleToKtsConverter.prototype.convertFileTree = function (text) {
        var fileTreeString = /fileTree\(dir(\s*):(\s*)"libs"(\s*),(\s*)include(\s*):(\s*)\["\*.jar"\]\)/g;
        return text.replace(fileTreeString, 'fileTree(mapOf("dir" to "libs", "include" to listOf("*.jar")))');
    };
    GradleToKtsConverter.prototype.convertArrayExpression = function (text) {
        return this.replaceWithCallback(text, /\[([^\]]*?)\]/g, function (match) {
            var content = match[1].trim();
            return content && !/^\d+$/.test(content) ? "listOf(".concat(content, ")") : match[0];
        });
    };
    GradleToKtsConverter.prototype.convertManifestPlaceHoldersWithMap = function (text) {
        var regExp = /manifestPlaceholders = (mapOf\([^\)]*\))/g;
        return text.replace(regExp, "manifestPlaceholders.putAll($1)");
    };
    GradleToKtsConverter.prototype.convertVariableDeclaration = function (text) {
        var _this = this;
        var varDeclExp = /(?:final\s+)?(\w+)(<.+>)? +(\w+)\s*=\s*(.+)/g;
        return this.replaceWithCallback(text, varDeclExp, function (match) {
            var type = match[1], genericsType = match[2], id = match[3], value = match[4];
            return type === "val"
                ? match[0]
                : "val ".concat(id, ": ").concat(_this.convertType(type)).concat(genericsType || "", " = ").concat(value);
        });
    };
    GradleToKtsConverter.prototype.convertType = function (type) {
        var typeMap = {
            byte: "Byte",
            short: "Short",
            int: "Int",
            long: "Long",
            float: "Float",
            double: "Double",
            char: "Char",
            boolean: "Boolean",
        };
        return typeMap[type] || type;
    };
    GradleToKtsConverter.prototype.convertPlugins = function (text) {
        var pluginsExp = /apply plugin: (\S+)/g;
        return this.replaceWithCallback(text, pluginsExp, function (match) { return "apply(plugin = ".concat(match[1], ")"); });
    };
    GradleToKtsConverter.prototype.convertPluginsIntoOneBlock = function (text) {
        var fullLineExp = /(apply\(plugin\s*=\s*".*"\)[\s\S]){2,}/g;
        var isolatedId = /".*"(?=\))/g;
        return this.replaceWithCallback(text, fullLineExp, function (match) {
            var _a;
            var plugins = ((_a = match[0]
                .match(isolatedId)) === null || _a === void 0 ? void 0 : _a.map(function (id) { return "    id(".concat(id, ")"); }).join("\n")) || "";
            return "plugins {\n".concat(plugins, "\n}\n");
        });
    };
    GradleToKtsConverter.prototype.convertPluginsFrom = function (text) {
        var pluginsExp = /apply from: (\S+)/g;
        return this.replaceWithCallback(text, pluginsExp, function (match) { return "apply(from = ".concat(match[1], ")"); });
    };
    GradleToKtsConverter.prototype.convertVariantFilter = function (text) {
        var arrayExp = /variantFilter\s*\{\s*(\w+\s*->)/g;
        return this.replaceWithCallback(text, arrayExp, function (match) {
            return "variantFilter { // ".concat(match[1], " - TODO Manually replace '").concat(match[1], "' variable with this, and setIgnore(true) with ignore = true\n");
        });
    };
    GradleToKtsConverter.prototype.convertAndroidBuildConfigFunctions = function (text) {
        var outerExp = /(buildConfigField|resValue|flavorDimensions|exclude|java\.srcDir)\s+(".*")/g;
        return this.replaceWithCallback(text, outerExp, function (match) { return "".concat(match[1], "(").concat(match[2], ")"); });
    };
    GradleToKtsConverter.prototype.convertCompileToImplementation = function (text) {
        var outerExp = /(compile|testCompile)(?!O).*".*"/g;
        return this.replaceWithCallback(text, outerExp, function (match) {
            if (match[0].includes("testCompile")) {
                return match[0].replace("testCompile", "testImplementation");
            }
            else {
                return match[0].replace("compile", "implementation");
            }
        });
    };
    GradleToKtsConverter.prototype.replaceCoreLibraryDesugaringEnabled = function (text) {
        return text.replace("coreLibraryDesugaringEnabled", "isCoreLibraryDesugaringEnabled");
    };
    GradleToKtsConverter.prototype.convertDependencies = function (text) {
        var testKeywords = "testImplementation|androidTestImplementation|debugImplementation|releaseImplementation|compileOnly|testCompileOnly|runtimeOnly|developmentOnly";
        var gradleKeywords = "(".concat(testKeywords, "|implementation|api|annotationProcessor|classpath|kaptTest|kaptAndroidTest|kapt|check|ksp|coreLibraryDesugaring|detektPlugins|lintPublish|lintCheck)");
        var validKeywords = new RegExp("(?!".concat(gradleKeywords, "\\s*(\\{|\"\\)|\\.))").concat(gradleKeywords, ".*"), "g");
        return this.replaceWithCallback(text, validKeywords, function (match) {
            var _a, _b;
            if (match[0].match(/\)(\s*)\{/))
                return match[0];
            var comment = ((_a = match[0].match(/\s*\/\/.*/)) === null || _a === void 0 ? void 0 : _a[0]) || "";
            var processedSubstring = match[0].replace(comment, "");
            var gradleKeyword = (_b = processedSubstring.match(new RegExp(gradleKeywords))) === null || _b === void 0 ? void 0 : _b[0];
            var isolated = processedSubstring
                .replace(new RegExp(gradleKeywords), "")
                .trim();
            if (isolated !== "" &&
                (isolated[0] !== "(" || isolated[isolated.length - 1] !== ")")) {
                return "".concat(gradleKeyword, "(").concat(isolated, ")").concat(comment);
            }
            else {
                return "".concat(gradleKeyword).concat(isolated).concat(comment);
            }
        });
    };
    GradleToKtsConverter.prototype.convertMaven = function (text) {
        var mavenExp = /maven\s*\{\s*url\s*(.*?)\s*?}/g;
        return this.replaceWithCallback(text, mavenExp, function (match) {
            return match[0]
                .replace(/(= *uri *\()|(\)|(url)|( ))/g, "")
                .replace("{", "(")
                .replace("}", ")");
        });
    };
    GradleToKtsConverter.prototype.addParentheses = function (text) {
        var sdkExp = /(compileSdkVersion|minSdkVersion|targetSdkVersion|consumerProguardFiles)\s*([^\s]*)(.*)/g;
        return this.replaceWithCallback(text, sdkExp, function (match) {
            var keyword = match[1], value = match[2], rest = match[3];
            return "".concat(keyword, "(").concat(value, ")").concat(rest);
        });
    };
    GradleToKtsConverter.prototype.addEquals = function (text) {
        var keywords = [
            "compileSdk",
            "applicationId",
            "minSdk",
            "targetSdk",
            "versionCode",
            "versionName",
            "testInstrumentationRunner",
            "namespace",
            "keyAlias",
            "keyPassword",
            "storeFile",
            "storePassword",
            "multiDexEnabled",
            "correctErrorTypes",
            "javaMaxHeapSize",
            "jumboMode",
            "dimension",
            "useSupportLibrary",
            "kotlinCompilerExtensionVersion",
            "isCoreLibraryDesugaringEnabled",
            "dataBinding",
            "viewBinding",
        ];
        var versionExp = new RegExp("(".concat(keywords.join("|"), ")\\s*([^\\s{].*)"), "g");
        return this.replaceWithCallback(text, versionExp, function (match) {
            var key = match[1], value = match[2];
            return "".concat(key, " = ").concat(value);
        });
    };
    GradleToKtsConverter.prototype.convertJavaCompatibility = function (text) {
        var compatibilityExp = /(sourceCompatibility|targetCompatibility).*/g;
        return this.replaceWithCallback(text, compatibilityExp, function (match) {
            var split = match[0].replace(/"]*/g, "").split(/\s+/);
            if (split.length > 1) {
                if (split[split.length - 1].includes("JavaVersion")) {
                    return "".concat(split[0], " = ").concat(split[split.length - 1]);
                }
                else {
                    return "".concat(split[0], " = JavaVersion.VERSION_").concat(split[split.length - 1].replace(/\./g, "_"));
                }
            }
            return match[0];
        });
    };
    GradleToKtsConverter.prototype.convertCleanTask = function (text) {
        var cleanExp = /task clean\(type: Delete\)\s*\{[\s\S]*}/g;
        var registerClean = "tasks.register<Delete>(\"clean\").configure {\n    delete(rootProject.buildDir)\n }";
        return text.replace(cleanExp, registerClean);
    };
    GradleToKtsConverter.prototype.convertProguardFiles = function (text) {
        var proguardExp = /proguardFiles .*/g;
        return this.replaceWithCallback(text, proguardExp, function (match) {
            var isolatedArgs = match[0].replace(/proguardFiles\s*/, "");
            return "setProguardFiles(listOf(".concat(isolatedArgs, "))");
        });
    };
    GradleToKtsConverter.prototype.convertInternalBlocks = function (text) {
        var _this = this;
        var blocks = [
            { title: "androidExtensions", transform: "experimental" },
            { title: "dataBinding", transform: "enabled" },
            { title: "lintOptions", transform: "abortOnError" },
            { title: "buildTypes", transform: "debuggable" },
            { title: "buildTypes", transform: "minifyEnabled" },
            { title: "buildTypes", transform: "shrinkResources" },
            { title: "", transform: "transitive" },
        ];
        return blocks.reduce(function (acc, _a) {
            var title = _a.title, transform = _a.transform;
            return _this.addIsToStr(acc, title, transform);
        }, text);
    };
    GradleToKtsConverter.prototype.addIsToStr = function (text, blockTitle, transform) {
        var extensionsExp = new RegExp("".concat(blockTitle, "\\s*\\{[\\s\\S]*\\}"), "g");
        if (!extensionsExp.test(text))
            return text;
        var typesExp = new RegExp("".concat(transform, ".*"), "g");
        return this.replaceWithCallback(text, typesExp, function (match) {
            var split = match[0].split(/\s+/);
            if (split.length > 1) {
                return "is".concat(split[0][0].toUpperCase() + split[0].slice(1), " = ").concat(split[split.length - 1]);
            }
            return match[0];
        });
    };
    GradleToKtsConverter.prototype.convertInclude = function (text) {
        var expressionBase = /\s*((".*"\s*,)\s*)*(".*")/;
        var includeExp = new RegExp("include".concat(expressionBase.source), "g");
        return this.replaceWithCallback(text, includeExp, function (match) {
            var _a, _b;
            if (match[0].includes('include"'))
                return match[0];
            var multiLine = match[0].split("\n").filter(function (line) { return line.trim(); }).length > 1;
            var isolated = ((_b = (_a = match[0].match(expressionBase)) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.trim()) || "";
            return multiLine ? "include(\n".concat(isolated, "\n)") : "include(".concat(isolated, ")");
        });
    };
    GradleToKtsConverter.prototype.convertExcludeClasspath = function (text) {
        var fullLineExp = /.*configurations\.classpath\.exclude.*group:.*/g;
        var innerExp = /".*"/;
        return this.replaceWithCallback(text, fullLineExp, function (match) {
            var _a;
            var isolatedStr = ((_a = match[0].match(innerExp)) === null || _a === void 0 ? void 0 : _a[0]) || "";
            return "configurations.classpath {\n    exclude(group = ".concat(isolatedStr, ")\n}");
        });
    };
    GradleToKtsConverter.prototype.convertExcludeModules = function (text) {
        var fullLineExp = /exclude module: (\S+)/g;
        return this.replaceWithCallback(text, fullLineExp, function (match) {
            var moduleId = match[1];
            return "exclude(module = ".concat(moduleId, ")");
        });
    };
    GradleToKtsConverter.prototype.convertExcludeGroups = function (text) {
        var fullLineExp = /exclude group: (\S+)/g;
        return this.replaceWithCallback(text, fullLineExp, function (match) {
            var groupId = match[1];
            return "exclude(group = ".concat(groupId, ")");
        });
    };
    GradleToKtsConverter.prototype.convertJetBrainsKotlin = function (text) {
        var fullLineExp = /"org\.jetbrains\.kotlin:kotlin-.*(?=\))/g;
        var removeExp = /(?!org\.jetbrains\.kotlin:kotlin)-.*"/;
        return this.replaceWithCallback(text, fullLineExp, function (match) {
            var _a;
            var substring = (((_a = match[0].match(removeExp)) === null || _a === void 0 ? void 0 : _a[0]) || "")
                .slice(1)
                .replace('"', "");
            var splittedSubstring = substring.split(":");
            if (substring.includes("stdlib")) {
                return 'kotlin("stdlib")';
            }
            else if (splittedSubstring.length === 2) {
                return "kotlin(\"".concat(splittedSubstring[0], "\", version = \"").concat(splittedSubstring[1], "\")");
            }
            else {
                return "kotlin(\"".concat(splittedSubstring[0], "\")");
            }
        });
    };
    GradleToKtsConverter.prototype.convertSigningConfigBuildType = function (text) {
        var outerExp = /signingConfig.*signingConfigs.*/g;
        return this.replaceWithCallback(text, outerExp, function (match) {
            var release = match[0].replace(/signingConfig.*signingConfigs\./, "");
            return "signingConfig = signingConfigs.getByName(\"".concat(release, "\")");
        });
    };
    GradleToKtsConverter.prototype.convertExtToExtra = function (text) {
        var outerExp = /ext\.(\w+)\s*=\s*(.*)/g;
        return this.replaceWithCallback(text, outerExp, function (match) {
            var name = match[1], value = match[2];
            return "extra[\"".concat(name, "\"] = ").concat(value);
        });
    };
    GradleToKtsConverter.prototype.addParenthesisToId = function (text) {
        var idExp = /id\s*"(.*?)"/g;
        return this.replaceWithCallback(text, idExp, function (match) {
            var value = match[1];
            return "id(\"".concat(value, "\")");
        });
    };
    GradleToKtsConverter.prototype.replaceColonWithEquals = function (text) {
        var expression = /\w*:\s*".*?"/g;
        return this.replaceWithCallback(text, expression, function (match) {
            return match[0].replace(":", " =");
        });
    };
    GradleToKtsConverter.prototype.convertBuildTypes = function (text) {
        return this.convertNestedTypes(text, "buildTypes", "named");
    };
    GradleToKtsConverter.prototype.convertProductFlavors = function (text) {
        return this.convertNestedTypes(text, "productFlavors", "create");
    };
    GradleToKtsConverter.prototype.convertSourceSets = function (text) {
        return this.convertNestedTypes(text, "sourceSets", "named");
    };
    GradleToKtsConverter.prototype.convertSigningConfigs = function (text) {
        return this.convertNestedTypes(text, "signingConfigs", "register");
    };
    GradleToKtsConverter.prototype.convertNestedTypes = function (text, buildTypes, named) {
        var _this = this;
        var regex = new RegExp("".concat(buildTypes, "\\s*\\{"), "g");
        return this.getExpressionBlock(text, regex, function (substring) {
            return _this.replaceWithCallback(substring, /\S*\s(?=\{)/g, function (match) {
                var valueWithoutWhitespace = match[0].replace(/\s/g, "");
                return "".concat(named, "(\"").concat(valueWithoutWhitespace, "\") ");
            });
        });
    };
    GradleToKtsConverter.prototype.getExpressionBlock = function (text, expression, modifyResult) {
        var matches = text.match(expression);
        if (!matches)
            return text;
        var result = text;
        for (var _i = 0, matches_1 = matches; _i < matches_1.length; _i++) {
            var match = matches_1[_i];
            var startIndex = result.indexOf(match);
            var count = 0;
            var endIndex = startIndex;
            for (var i = startIndex; i < result.length; i++) {
                if (result[i] === "{")
                    count++;
                if (result[i] === "}")
                    count--;
                if (count === 0) {
                    endIndex = i + 1;
                    break;
                }
            }
            var block = result.substring(startIndex, endIndex);
            var convertedBlock = modifyResult(block);
            result =
                result.substring(0, startIndex) +
                    convertedBlock +
                    result.substring(endIndex);
        }
        return result;
    };
    GradleToKtsConverter.prototype.convertBuildFeatures = function (text) {
        var buildFeatures = "(dataBinding|viewBinding|aidl|buildConfig|prefab|renderScript|resValues|shaders|compose)";
        var state = "(false|true)";
        var regex = new RegExp("".concat(buildFeatures, "\\s").concat(state), "g");
        return this.replaceWithCallback(text, regex, function (match) {
            return match[0].replace(" ", " = ");
        });
    };
    return GradleToKtsConverter;
}());
exports.GradleToKtsConverter = GradleToKtsConverter;
