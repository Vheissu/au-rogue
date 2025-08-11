# Publishing au-rogue to NPM

This guide covers how to publish au-rogue to npm.

## Prerequisites

1. **npm account**: Create an account at [npmjs.com](https://npmjs.com) if you don't have one
2. **npm CLI**: Make sure you have npm installed and are logged in
3. **Package name**: Verify the package name "au-rogue" is available (currently it is)

## Pre-publication Checklist

Before publishing, ensure:

- [ ] All tests pass: `pnpm test`
- [ ] Package builds successfully: `pnpm run build`
- [ ] Version number is updated appropriately
- [ ] CHANGELOG.md is updated with changes
- [ ] README.md is comprehensive and accurate
- [ ] Package contents are correct: `npm pack --dry-run`

## Publishing Steps

### 1. Login to npm

```bash
npm login
# Follow prompts to enter your npm credentials
```

### 2. Verify package contents

```bash
npm pack --dry-run
# Review the output to ensure only necessary files are included
```

### 3. Test the package locally (optional but recommended)

```bash
# Create a test package
npm pack
# This creates au-rogue-0.1.0.tgz

# In another directory, test installing it
mkdir /tmp/test-au-rogue
cd /tmp/test-au-rogue
npm install /path/to/au-rogue/au-rogue-0.1.0.tgz

# Test the CLI
npx au-rogue --help
```

### 4. Publish to npm

```bash
# For initial publish (version 0.1.0)
npm publish

# For future versions, update package.json version first, then:
npm publish
```

### 5. Verify publication

```bash
# Check that it's available
npm info au-rogue

# Test global install
npm install -g au-rogue
au-rogue --help
```

## Version Management

Follow semantic versioning (semver):

- **Patch** (0.1.1): Bug fixes, no breaking changes
- **Minor** (0.2.0): New features, no breaking changes  
- **Major** (1.0.0): Breaking changes

Update versions:

```bash
# Patch version
npm version patch

# Minor version  
npm version minor

# Major version
npm version major

# Then publish
npm publish
```

## Post-publication

1. **Update GitHub repository** (if applicable):
   - Push the version tag: `git push --tags`
   - Create a GitHub release

2. **Announce the release**:
   - Aurelia Discord/community
   - Social media
   - Blog post (if significant update)

3. **Monitor for issues**:
   - Check npm download stats
   - Monitor GitHub issues
   - Watch for user feedback

## Package Maintenance

- Keep dependencies updated
- Monitor security vulnerabilities
- Respond to user issues promptly
- Add new transformation passes as needed
- Keep documentation current

## Troubleshooting

**Common issues:**

1. **Package name taken**: Choose a different name like `@your-username/au-rogue`
2. **Permission denied**: Make sure you're logged in with `npm login`
3. **Build failures**: Run `pnpm run prepublishOnly` to test the full pipeline
4. **Large package size**: Check .npmignore and the files field in package.json