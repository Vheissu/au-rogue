# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2025-01-08

### Added
- Initial release of au-rogue migration tool
- Conservative Aurelia 1 to 2 codemods with comprehensive reporting
- **Dependency Injection transformation**: Convert @autoinject to resolve() patterns
- **Computed properties transformation**: Remove @computedFrom decorators with guidance
- **PLATFORM.moduleName() removal**: Clean up module resolution patterns
- **Template transformations**: Convert .delegate to .trigger, analyze preventDefault needs
- **Router analysis**: Detect and provide guidance for router migration patterns
- **Lifecycle method analysis**: Identify v1 lifecycle methods and suggest v2 equivalents
- **Bootstrap migration guidance**: Provide complete migration examples for main.ts
- **Compatibility suggestions**: Recommend @aurelia/compat-v1 when beneficial
- Comprehensive test suite with 107 tests
- Example Aurelia 1 codebase for demonstration
- Detailed markdown and JSON reporting
- CLI with dry-run mode for safe exploration

### Features
- **Conservative approach**: Only transforms what's safe, reports everything else
- **Multiple transformation passes**: DI, computed, PLATFORM, templates, router, lifecycle, bootstrap
- **Rich reporting**: Categorized edits, warnings, and notes with code diffs
- **Glob-based file discovery**: Flexible source and template file patterns
- **TypeScript AST manipulation**: Precise code transformations using ts-morph
- **HTML template analysis**: Parse and transform Aurelia templates using parse5

### CLI Options
- `--dry`: Dry run mode to preview changes without modifying files
- `--sources <glob...>`: Specify TypeScript/JavaScript source file patterns
- `--templates <glob...>`: Specify HTML template file patterns  
- `--compat`: Enable compatibility mode suggestions
- `--report-dir <dir>`: Specify output directory for reports