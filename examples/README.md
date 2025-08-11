# Aurelia 1 Example Code

This directory contains realistic Aurelia 1 application code that demonstrates various patterns the au-rogue migration tool can handle.

## Files Overview

- **main.ts** - Bootstrap configuration with plugins, features, and environment-specific setup
- **app.ts** - Root component with router configuration, computed properties, and DI
- **pages/user-details.ts** - Route component with lifecycle methods, NavigationInstruction usage
- **components/user-card.ts** - Custom element with decorators, computed properties, compat patterns
- **components/user-list.ts/.html** - Component with templates showing event handlers
- **services/user-service.ts** - Service with HTTP client and PLATFORM usage
- **value-converters/date-format.ts** - Value converter with DI

## Running the Migration Tool

### Quick Demo
```bash
# From the examples directory
./run-migration.sh
```

### Manual Usage
```bash
# Run from the au-rogue root directory
pnpm run build

# Dry run to see what would change (recommended first)
node dist/cli.js --sources "examples/**/*.ts" --templates "examples/**/*.html" --dry

# Actually apply the transformations
node dist/cli.js --sources "examples/**/*.ts" --templates "examples/**/*.html"

# With compat mode suggestions
node dist/cli.js --sources "examples/**/*.ts" --templates "examples/**/*.html" --compat --dry
```

This will show you:

1. **Bootstrap migration guidance** for main.ts
2. **Router configuration analysis** for app.ts and user-details.ts
3. **PLATFORM.moduleName() removal** from multiple files
4. **@computedFrom removal** from components
5. **DI transformation** for @autoinject usage
6. **Lifecycle method analysis** in route components
7. **Template event handler analysis** in HTML files
8. **Compatibility package suggestions** for advanced decorators

## Expected Transformations

### Bootstrap (main.ts)
- Detects Aurelia 1 bootstrap patterns
- Provides Aurelia 2 equivalent code
- Maps plugins to v2 equivalents
- Warns about unknown plugins

### Router (app.ts, user-details.ts)
- Analyzes configureRouter() methods
- Detects router lifecycle method usage
- Identifies NavigationInstruction patterns
- Suggests migration strategies

### PLATFORM.moduleName() (multiple files)
- Removes PLATFORM.moduleName() wrapper calls
- Preserves the inner module path
- Works in various contexts (imports, routes, etc.)

### Dependency Injection (multiple files)
- Converts @autoinject to constructor parameter decorators
- Handles both simple and complex injection scenarios

### Computed Properties (multiple files)
- Removes @computedFrom decorators
- Provides guidance on getter dependencies

### Templates (user-list.html)
- Analyzes event handlers for preventDefault needs
- Identifies patterns that may behave differently in v2

### Lifecycle Methods (user-details.ts)
- Detects v1 lifecycle methods
- Suggests v2 equivalents
- Identifies anti-patterns

### Compatibility Suggestions
- Detects patterns that benefit from @aurelia/compat-v1
- Suggests installation when needed