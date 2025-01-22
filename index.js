const fs = require("fs").promises;
const path = require("path");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const glob = require("glob-promise");
const chalk = require("chalk");
const { GradleToKtsConverter } = require("./logic"); // Import the GradleToKtsConverter
const { log } = require("console");

class GradleConverter {
    constructor(apiKey, model = "gemini-pro") {
        this.apiKey = apiKey;
        this.modelName = model;
        this.genAI = new GoogleGenerativeAI(apiKey);
        this.model = this.genAI.getGenerativeModel({ model: this.modelName });

        this.localConverter = new GradleToKtsConverter(); // Initialize GradleToKtsConverter

        this.promptRemoveKotlinErrors = `
            You are a post-processor for converting Groovy-based build.gradle to Kotlin-based build.gradle.kts. The input is partially converted to Kotlin DSL. Your task is to:
            1. Review and correct any syntax errors or incomplete Kotlin conversions.
            2. Ensure compatibility with the Kotlin DSL, including:
            - Correctly handling Groovy closures converted to Kotlin lambdas.
            - Proper syntax for nested blocks (e.g., repositories, dependencies).
            - Maintaining the functionality and configurations of plugins, tasks, and dependencies.
            3. Apply Kotlin idioms, such as type-safe accessors, property access, and string interpolation.
            4. make sure to use proper sourceSets and configurations
            5. gradle kts dsl recommended  settings
            6. Return only the finalized Kotlin code without explanations.


            Example Input (Partially Converted Kotlin):
            \`\`\`
            plugins {
                id("someplugin")
                alias(a.b.c)
                alias(kapt())
            }
            sourceSets.get {
                main {
                    manifest.srcFile("java/co/branch/coreui/AndroidManifest.xml")
                    java.srcDir("java")
                    java.includes.setFrom(srcDirs.map { it + "/**/*.kt" })
                    java.excludes.add("**/build/**")
                    srcDirs.forEach {
                        res.srcDirs += "java/$it/res"
                    }
                }
                test {
                    java.srcDir("javatest")
                }
            }

            dependencies {
                implementation("org.springframework:spring-core:5.0.0")
                implementation projects.core
                implementation projects.coreUi
                implementation(libs.androidx.constraint.layout)
            }
            \`\`\`

            Example Output (Final Kotlin):
            \`\`\`
            plugins {
                id("someplugin")
                alias(a.b.c)
                alias(kapt) // need to remove the brackets
            }
             sourceSets.getByName("main") {
                manifest.srcFile("java/co/branch/coreui/AndroidManifest.xml")
                java.srcDir("java")
                java.includes.addAll(srcDirs.map { it + "/**/*.kt" })
                java.excludes.add("**/build/**")
                srcDirs.forEach {
                res.srcDirs("java/$it/res")
            }
            
            sourceSets.getByName("test"){
                java.srcDir("javatest")
            }
            dependencies {
                implementation("org.springframework:spring-core:5.0.0")
                implementation(projects.core)
                implementation(projects.coreUi)
                implementation(libs.androidx.constraint.layout)
            }
            \`\`\`

            Now fix the following partially converted build.gradle.kts content:
        `;

        
        this.systemPrompt = `
            You are a build.gradle to build.gradle.kts converter. Convert the given Groovy-based
            build.gradle content to Kotlin-based build.gradle.kts format. Follow these rules:
            1. Maintain all functionality and dependencies
            2. Use proper Kotlin syntax and idioms
            3. Keep all version numbers and configurations
            4. Add type safety where applicable
            5. make sure to use string literal "" for strings 
            5. Return only the converted code without explanations
            
            
            Example conversion:
            Input (Groovy):
            \`\`\`
            plugins {
                id 'java'
                alias(a.b.c)
            }
            
            dependencies {
                implementation 'org.springframework:spring-core:5.0.0'
            }
            \`\`\`
            
            Output (Kotlin):
            \`\`\`
            plugins {
                java
                alias(a.b.c)
            }
            
            dependencies {
                implementation("org.springframework:spring-core:5.0.0")
            }
            \`\`\`
            
            Now convert the following build.gradle file:
        `;
    }

    async convertByParser(gradleContent) {
        try {
            const convertedContent = this.localConverter.convert(gradleContent);
            return convertedContent;
        } catch (error) {
            console.error(chalk.red(`Error during conversion: ${error.message}`));
            throw error;
        }
    }

    async improveByModel(convertedContent) {
        try {
            const fullPrompt = `${this.promptRemoveKotlinErrors}\n${convertedContent}`;
            const result = await this.model.generateContent(fullPrompt);
            const response = await result.response;
            let improvedContent = response.text();
            
            improvedContent = improvedContent
                .replace(/```kotlin/g, "")
                .replace(/```/g, "")
                .trim();

            return improvedContent;
        } catch (error) {
            console.error(chalk.red(`Error during API call: ${error.message}`));
            throw error;
        }
    }   

    async convertSingleFile(gradleContent) {
        try {
            const fullPrompt = `${this.systemPrompt}\n${gradleContent}`;
            const result = await this.model.generateContent(fullPrompt);
            const response = await result.response;
            let convertedContent = response.text();

            convertedContent = convertedContent
                .replace(/```kotlin/g, "")
                .replace(/```/g, "")
                .trim();

            return convertedContent;
        } catch (error) {
            console.error(chalk.red(`Error during API call: ${error.message}`));
            throw error;
        }
    }

    async validateConversion(originalContent, convertedContent) {
        const keyElements = ["dependencies", "plugins", "repositories"];
        const kotlinMarkers = ["val", "plugins {", "implementation("];

        for (const element of keyElements) {
            if (
                originalContent.toLowerCase().includes(element) &&
                !convertedContent.toLowerCase().includes(element)
            ) {
                console.warn(
                    chalk.yellow(
                        `Validation warning: ${element} might be missing in conversion`
                    )
                );
            }
        }

        if (
            !kotlinMarkers.some((marker) => convertedContent.includes(marker))
        ) {
            console.warn(
                chalk.yellow(
                    "Validation warning: Converted content might not be valid Kotlin"
                )
            );
        }
    }

    async processDirectory(inputDir, createBackup = true, convertDirectlyByModel = false, parserOnly = false,singleExecution = false) {
        try {
            const gradleFiles = await glob("**/build.gradle", {
                cwd: inputDir,
                absolute: true,
                ignore: ["**/node_modules/**", "**/build/**"],
            });

            console.log(
                chalk.blue(`Found ${gradleFiles.length} build.gradle files`)
            );

            let isOnce = 0;

            for (const gradleFile of gradleFiles) {
                if (singleExecution) {
                    if (isOnce < 0) break;
                    isOnce--
                }
                try {
                    const backupPath = `${gradleFile}_backup.txt`;

                    // Always create backup for safety
                    if (!(await this.fileExists(backupPath))) {
                        await fs.copyFile(gradleFile, backupPath);
                        console.log(
                            chalk.green(`Created backup: ${backupPath}`)
                        );
                    }

                    // Read the original content from the backup
                    const originalContent = await fs.readFile(
                        backupPath,
                        "utf8"
                    );

                    let convertedContent = null;

                    if (parserOnly) {

                        console.log(chalk.blue(`Converting by Parser ${gradleFile}`));
                        convertedContent = await this.convertByParser(
                            originalContent
                        );
                    } else if(convertDirectlyByModel) {
                        // Convert the content directly by model
                        console.log(chalk.blue(`Converting by Model ${gradleFile}`));
                        convertedContent = await this.convertSingleFile(
                            originalContent
                        );
                    } else {
                        console.log(chalk.blue(`Converting by Parser ${gradleFile}`));
                        convertedContent = await this.convertByParser(
                            originalContent
                        );

                        console.log(chalk.blue(`Improving by Model ${gradleFile}`));
                        convertedContent = await this.improveByModel(
                            convertedContent
                        );
                    }

                    // Validate the conversion
                    await this.validateConversion(
                        originalContent,
                        convertedContent
                    );

                    // Write the new .kts file
                    const ktsPath = gradleFile.replace(
                        ".gradle",
                        ".gradle.kts"
                    );
                    await fs.writeFile(ktsPath, convertedContent, "utf8");

                    // Delete the original build.gradle file
                    await fs.unlink(gradleFile);
                    console.log(
                        chalk.yellow(`Deleted original file: ${gradleFile}`)
                    );

                    // If no backup was requested, delete the backup file
                    if (!createBackup) {
                        await fs.unlink(backupPath);
                        console.log(
                            chalk.yellow(`Deleted backup file: ${backupPath}`)
                        );
                    }

                    console.log(
                        chalk.green(
                            `Successfully converted ${gradleFile} to ${ktsPath}`
                        )
                    );
                } catch (error) {
                    console.error(
                        chalk.red(
                            `Error processing ${gradleFile}: ${error.message}`
                        )
                    );
                    // In case of error, try to restore from backup
                    try {
                        const backupPath = `${gradleFile}.backup`;
                        if (await this.fileExists(backupPath)) {
                            await fs.copyFile(backupPath, gradleFile);
                            console.log(
                                chalk.green(
                                    `Restored original file from backup due to error`
                                )
                            );
                        }
                    } catch (restoreError) {
                        console.error(
                            chalk.red(
                                `Failed to restore from backup: ${restoreError.message}`
                            )
                        );
                    }
                }
            }
        } catch (error) {
            console.error(
                chalk.red(`Error processing directory: ${error.message}`)
            );
            throw error;
        }
    }

    async fileExists(filePath) {
        try {
            await fs.access(filePath);
            return true;
        } catch {
            return false;
        }
    }
}

async function main() {
    const args = require("yargs")
        .option("input", {
            alias: "i",
            description: "Input directory containing build.gradle files",
            type: "string",
            demandOption: true,
        })
        .option("api-key", {
            alias: "k",
            description: "Google API key for Gemini",
            type: "string",
            demandOption: true,
        })
        .option("no-backup", {
            alias: "n",
            description: "Disable backup creation of original files",
            type: "boolean",
            default: false,
        }).option("static", {
            alias: "nm",
            type: "boolean",
            default: false
        }).option("only-model", {
            alias: "om",
            type: "boolean",
            default: false
        }).option("run-once", {
            alias: "ro",
            type: "boolean",
            default: false
        })
        .help().argv;

    const converter = new GradleConverter(args.apiKey);
    const static = args["static"];
    const modelOnly = args["only-model"];
    const singleExecution = args["run-once"]
    console.log( 'static' , static, ' modelOnly', modelOnly)
    await converter.processDirectory(args.input, !args["no-backup"],modelOnly ,static,singleExecution );

}

if (require.main === module) {
    main().catch((error) => {
        console.error(chalk.red(`Fatal error: ${error.message}`));
        process.exit(1);
    });
}

module.exports = GradleConverter;