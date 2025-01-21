const fs = require("fs").promises;
const path = require("path");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const glob = require("glob-promise");
const chalk = require("chalk");

class GradleConverter {
    constructor(apiKey, model = "gemini-pro") {
        this.apiKey = apiKey;
        this.modelName = model;
        this.genAI = new GoogleGenerativeAI(apiKey);
        this.model = this.genAI.getGenerativeModel({ model: this.modelName });

        // System prompt for the conversion
        this.systemPrompt = `
            You are a build.gradle to build.gradle.kts converter. Convert the given Groovy-based
            build.gradle content to Kotlin-based build.gradle.kts format. Follow these rules:
            1. Maintain all functionality and dependencies
            2. Use proper Kotlin syntax and idioms
            3. Keep all version numbers and configurations
            4. Add type safety where applicable
            5. Return only the converted code without explanations
            
            Example conversion:
            Input (Groovy):
            \`\`\`
            plugins {
                id 'java'
            }
            
            dependencies {
                implementation 'org.springframework:spring-core:5.0.0'
            }
            \`\`\`
            
            Output (Kotlin):
            \`\`\`
            plugins {
                java
            }
            
            dependencies {
                implementation("org.springframework:spring-core:5.0.0")
            }
            \`\`\`
            
            Now convert the following build.gradle file:
        `;
    }

    async convertSingleFile(gradleContent) {
        try {
            const fullPrompt = `${this.systemPrompt}\n${gradleContent}`;
            const result = await this.model.generateContent(fullPrompt);
            const response = await result.response;
            let convertedContent = response.text();

            // Clean up the response - remove any markdown code blocks if present
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

        // Check for preserved key components
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

        // Check for Kotlin syntax markers
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

    async processDirectory(inputDir, createBackup = true) {
        try {
            // Find all build.gradle files
            const gradleFiles = await glob("**/build.gradle", {
                cwd: inputDir,
                absolute: true,
                ignore: ["**/node_modules/**", "**/build/**"],
            });

            console.log(
                chalk.blue(`Found ${gradleFiles.length} build.gradle files`)
            );

            for (const gradleFile of gradleFiles) {
                try {
                    const backupPath = `${gradleFile}.backup`;

                    // Create backup if needed
                    if (createBackup) {
                        if (!(await this.fileExists(backupPath))) {
                            await fs.copyFile(gradleFile, backupPath);
                            console.log(
                                chalk.green(`Created backup: ${backupPath}`)
                            );
                        }
                    }

                    // Read the original content
                    const originalContent = await fs.readFile(
                        createBackup ? backupPath : gradleFile,
                        "utf8"
                    );

                    // Convert the content
                    console.log(chalk.blue(`Converting ${gradleFile}`));
                    const convertedContent = await this.convertSingleFile(
                        originalContent
                    );

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

// CLI handling
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
        })
        .help().argv;

    const converter = new GradleConverter(args.apiKey);
    await converter.processDirectory(args.input, !args["no-backup"]);
}

// Run the script if it's called directly
if (require.main === module) {
    main().catch((error) => {
        console.error(chalk.red(`Fatal error: ${error.message}`));
        process.exit(1);
    });
}

module.exports = GradleConverter;
