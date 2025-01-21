# Gradle to Kotlin DSL Converter

A tool to convert Gradle build scripts from Groovy DSL (`build.gradle`) to Kotlin DSL (`build.gradle.kts`).

## Prerequisites

-   Node.js installed
-   Google API key for Gemini model
-   npm dependencies installed (`npm install`)

## Installation

```sh
npm install
```
Basic usage:
```sh
npm run convert -- --input <directory> --api-key <your-google-api-key> 
```

# Command Line Options

| Option | Description | Required |
|--------|-------------|----------|
| `-i, --input` | Input directory containing build.gradle files | Yes |
| `-k, --api-key` | Google API key for Gemini model | Yes |
| `-n, --no-backup` | Disable backup creation of original files | No |
| `--only-parser` | Use only the local parser without AI model improvements | No |
| `--only-model` | Use only the AI model for conversion | No |
| `--run-once` | Convert only the first build.gradle file found | No |

## Examples

### Full Conversion
```bash

npm run convert -- -input ./my-project -api-key YOUR_API_KEY --run-once
```