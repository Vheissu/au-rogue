# au-rogue

Conservative codemods that migrate Aurelia 1 projects toward Aurelia 2. It edits only the parts that are safe to transform automatically, then writes a comprehensive report for everything else.

**🛡️ Conservative approach**: Only transforms what's guaranteed safe, reports everything else  
**📊 Comprehensive reporting**: Detailed analysis with migration guidance  
**🚀 Easy to use**: Simple CLI with dry-run mode for safe exploration

## Features

### Automatic Transformations
- ✅ Removes `@autoinject` decorators and converts to `resolve()` patterns
- ✅ Removes `@computedFrom` decorators (keeps getter methods)  
- ✅ Strips `PLATFORM.moduleName()` calls
- ✅ Converts template `.delegate` to `.trigger`
- ✅ Updates various template attributes and elements

### Analysis & Guidance
- 🔍 Detects router patterns needing manual migration
- 🔍 Identifies lifecycle method changes required
- 🔍 Flags `NavigationInstruction` usage 
- 🔍 Analyzes event handlers for `preventDefault` needs
- 🔍 Provides bootstrap migration examples
- 🔍 Suggests `@aurelia/compat-v1` when beneficial

### Reporting
- 📄 Generates detailed Markdown and JSON reports
- 📋 Categorizes changes: edits, warnings, notes
- 📈 Shows before/after code diffs
- 📝 Provides specific migration guidance

## Installation

```bash
# Install globally
npm install -g au-rogue

# Or run without installing
npx au-rogue --help
```

## Usage

### Quick Start

```bash
# Navigate to your Aurelia 1 project root
cd my-aurelia-app

# Run in dry mode first (recommended)
npx au-rogue --dry

# Review the generated reports:
# - au-rogue.report.md (human-readable)
# - au-rogue.report.json (machine-readable)

# Apply the transformations
npx au-rogue
```

### Command Line Options

```bash
# Show help
npx au-rogue --help

# Dry run (preview changes without modifying files)
npx au-rogue --dry

# Custom file patterns
npx au-rogue --sources "src/**/*.ts" --templates "src/**/*.html"

# Include compatibility suggestions
npx au-rogue --compat

# Custom report output directory
npx au-rogue --report-dir ./migration-reports
```

### Output Files

The tool generates two report files:
- **au-rogue.report.md** - Human-readable migration report
- **au-rogue.report.json** - Machine-readable data for tooling integration

## Example Output

Running au-rogue on an Aurelia 1 project provides detailed feedback:

```
📊 Migration Summary
Edits: 23, Adds: 0, Removes: 5, Warnings: 12, Notes: 18

✅ Automatic transformations:
• Removed @autoinject decorators from 8 classes
• Removed @computedFrom decorators from 5 getters  
• Removed 12 PLATFORM.moduleName() calls
• Updated .delegate to .trigger in 3 templates

⚠️  Manual review needed:
• Router configuration in App class needs migration
• 4 NavigationInstruction usages detected
• Event handlers may need preventDefault modifiers

💡 Migration guidance provided:
• Bootstrap migration example for main.ts
• Router migration strategies
• @aurelia/compat-v1 compatibility suggestions
```

## What Gets Transformed

### ✅ Safe Automatic Changes
- **Dependency Injection**: `@autoinject` → `resolve()` patterns
- **Computed Properties**: Remove `@computedFrom` decorators  
- **Platform Modules**: Remove `PLATFORM.moduleName()` wrappers
- **Templates**: `.delegate` → `.trigger`, attribute updates
- **Imports**: Clean up unused imports

### ⚠️ Flagged for Manual Review
- **Router patterns**: `configureRouter()`, `NavigationInstruction`
- **Complex DI**: Interface types, non-runtime types
- **Lifecycle methods**: v1 hooks needing v2 equivalents  
- **Event handlers**: Cases needing `preventDefault`
- **Bootstrap**: `main.ts` configuration migration

### 💡 Guidance Provided
- Complete bootstrap migration examples
- Router migration strategies (`@aurelia/router` vs `@aurelia/router-lite`)
- Compatibility package recommendations
- Lifecycle method mapping
- Best practices for manual migrations

## Safety & Reliability

- **Conservative approach**: Only transforms guaranteed-safe patterns
- **Comprehensive testing**: 107+ test cases covering edge cases
- **Idempotent**: Running multiple times is safe
- **Dry-run mode**: Preview all changes before applying
- **Detailed reporting**: Full transparency of all changes and decisions

## Contributing

See our [examples directory](./examples) for realistic test cases. The tool is designed to be:
- **Extensible**: Easy to add new transformation passes
- **Well-tested**: Every transformation has comprehensive test coverage  
- **Documented**: Clear examples and explanations

## License

MIT
