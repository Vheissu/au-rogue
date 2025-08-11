#!/bin/bash

# Script to demonstrate au-rogue migration tool
# This shows how the tool transforms Aurelia 1 code to be Aurelia 2 compatible

echo "🚀 Running au-rogue migration tool on example code..."
echo

cd ..

# First, let's show the original code
echo "📋 Original Aurelia 1 patterns in the examples:"
echo "• Bootstrap configuration with plugins and features"
echo "• Router configuration with configureRouter() method"
echo "• PLATFORM.moduleName() calls for module resolution"
echo "• @computedFrom decorators for computed properties" 
echo "• @autoinject decorators for dependency injection"
echo "• Router lifecycle methods with NavigationInstruction"
echo "• Template event handlers using .delegate"
echo

# Run the tool in dry mode to see what it would change
echo "🔧 Running migration tool (dry run)..."
node dist/cli.js --sources "examples/**/*.ts" --templates "examples/**/*.html" --dry

echo
echo "📊 Migration report generated! Check au-rogue.report.md for details."
echo
echo "🎯 Key transformations performed:"
echo "✅ Removed PLATFORM.moduleName() calls"
echo "✅ Removed @computedFrom decorators" 
echo "✅ Converted @autoinject to resolve() where possible"
echo "✅ Updated .delegate to .trigger in templates"
echo "⚠️  Identified router patterns needing manual migration"
echo "⚠️  Flagged NavigationInstruction usage"
echo "⚠️  Detected event handlers needing preventDefault"
echo "💡 Provided bootstrap migration guidance"
echo "💡 Suggested @aurelia/compat-v1 for complex decorators"
echo

echo "🔍 To see the actual file changes, run without --dry:"
echo "node dist/cli.js --sources \"examples/**/*.ts\" --templates \"examples/**/*.html\""
echo
echo "📚 The tool provides conservative migrations and comprehensive reporting"
echo "   to help you migrate safely from Aurelia 1 to Aurelia 2."