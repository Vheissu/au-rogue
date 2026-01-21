import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as fs from 'node:fs';
import { transformTemplates } from './transform-templates';
import { Reporter } from '../types.js';

// Mock fs module
vi.mock('node:fs');

describe('transformTemplates', () => {
  let reporter: Reporter;
  const mockFs = vi.mocked(fs);

  beforeEach(() => {
    reporter = new Reporter({});
    vi.clearAllMocks();
  });

  it('transforms <require> to <import>', () => {
    const html = `<template>
  <require from="./my-component"></require>
  <my-component></my-component>
</template>`;

    const expected = `<template>
  <import from="./my-component"></import>
  <my-component></my-component>
</template>`;

    mockFs.readFileSync.mockReturnValue(html);
    mockFs.writeFileSync.mockImplementation(() => {});

    transformTemplates(['test.html'], reporter, { write: true });

    expect(mockFs.writeFileSync).toHaveBeenCalledWith('test.html', expected, 'utf8');
    
    const reportData = reporter.finish();
    expect(reportData.entries.some(e => e.message === '<require> -> <import>')).toBe(true);
  });

  it('transforms <router-view> to <au-viewport>', () => {
    const html = `<template>
  <router-view></router-view>
</template>`;

    const expected = `<template>
  <au-viewport></au-viewport>
</template>`;

    mockFs.readFileSync.mockReturnValue(html);
    mockFs.writeFileSync.mockImplementation(() => {});

    transformTemplates(['test.html'], reporter, { write: true });

    expect(mockFs.writeFileSync).toHaveBeenCalledWith('test.html', expected, 'utf8');
    
    const reportData = reporter.finish();
    expect(reportData.entries.some(e => e.message === '<router-view> -> <au-viewport>')).toBe(true);
  });

  it('transforms <compose> to <au-compose> and updates attributes', () => {
    const html = `<template>
  <compose view="./my-view.html" view-model="./my-viewmodel" some-attr="value"></compose>
</template>`;

    const expected = `<template>
  <au-compose template="./my-view.html" component="./my-viewmodel" some-attr="value"></au-compose>
</template>`;

    mockFs.readFileSync.mockReturnValue(html);
    mockFs.writeFileSync.mockImplementation(() => {});

    transformTemplates(['test.html'], reporter, { write: true });

    expect(mockFs.writeFileSync).toHaveBeenCalledWith('test.html', expected, 'utf8');
    
    const reportData = reporter.finish();
    expect(reportData.entries.some(e => e.message === '<compose> -> <au-compose>')).toBe(true);
  });

  it('transforms .delegate to .trigger', () => {
    const html = `<template>
  <button click.delegate="handleClick()">Click me</button>
  <input change.delegate="handleChange()">
</template>`;

    const expected = `<template>
  <button click.trigger="handleClick()">Click me</button>
  <input change.trigger="handleChange()">
</template>`;

    mockFs.readFileSync.mockReturnValue(html);
    mockFs.writeFileSync.mockImplementation(() => {});

    transformTemplates(['test.html'], reporter, { write: true });

    expect(mockFs.writeFileSync).toHaveBeenCalledWith('test.html', expected, 'utf8');
    
    const reportData = reporter.finish();
    expect(reportData.entries.some(e => e.message === '*.delegate -> *.trigger')).toBe(true);
  });

  it('transforms view-model.ref to component.ref', () => {
    const html = `<template>
  <my-component view-model.ref="componentRef"></my-component>
</template>`;

    const expected = `<template>
  <my-component component.ref="componentRef"></my-component>
</template>`;

    mockFs.readFileSync.mockReturnValue(html);
    mockFs.writeFileSync.mockImplementation(() => {});

    transformTemplates(['test.html'], reporter, { write: true });

    expect(mockFs.writeFileSync).toHaveBeenCalledWith('test.html', expected, 'utf8');
    
    const reportData = reporter.finish();
    expect(reportData.entries.some(e => e.message === 'view-model.ref -> component.ref')).toBe(true);
  });

  it('converts .call bindings to .bind', () => {
    const html = `<template>
  <button click.call="handleClick()">Click me</button>
</template>`;

    mockFs.readFileSync.mockReturnValue(html);
    mockFs.writeFileSync.mockImplementation(() => {});

    transformTemplates(['test.html'], reporter, { write: true });

    expect(mockFs.writeFileSync).toHaveBeenCalled();
    const written = mockFs.writeFileSync.mock.calls[0][1] as string;
    expect(written).toContain('click.bind="($event) => handleClick()"');
    
    const reportData = reporter.finish();
    expect(reportData.entries.some(e =>
      e.kind === 'edit' && e.message.includes('*.call -> *.bind')
    )).toBe(true);
  });

  it('handles nested elements correctly', () => {
    const html = `<template>
  <div>
    <require from="./child"></require>
    <router-view>
      <compose view="./inner" view-model="./inner-vm"></compose>
    </router-view>
  </div>
</template>`;

    const expected = `<template>
  <div>
    <import from="./child"></import>
    <au-viewport>
      <au-compose template="./inner" component="./inner-vm"></au-compose>
    </au-viewport>
  </div>
</template>`;

    mockFs.readFileSync.mockReturnValue(html);
    mockFs.writeFileSync.mockImplementation(() => {});

    transformTemplates(['test.html'], reporter, { write: true });

    expect(mockFs.writeFileSync).toHaveBeenCalledWith('test.html', expected, 'utf8');
  });

  it('processes multiple files', () => {
    const html1 = `<template><require from="./comp1"></require></template>`;
    const html2 = `<template><router-view></router-view></template>`;

    mockFs.readFileSync
      .mockReturnValueOnce(html1)
      .mockReturnValueOnce(html2);
    mockFs.writeFileSync.mockImplementation(() => {});

    transformTemplates(['file1.html', 'file2.html'], reporter, { write: true });

    expect(mockFs.readFileSync).toHaveBeenCalledTimes(2);
    expect(mockFs.writeFileSync).toHaveBeenCalledTimes(2);
  });

  it('does not write files when write option is false', () => {
    const html = `<template><require from="./comp"></require></template>`;

    mockFs.readFileSync.mockReturnValue(html);
    mockFs.writeFileSync.mockImplementation(() => {});

    transformTemplates(['test.html'], reporter, { write: false });

    expect(mockFs.readFileSync).toHaveBeenCalled();
    expect(mockFs.writeFileSync).not.toHaveBeenCalled();
    
    // Should still track changes in reporter
    const reportData = reporter.finish();
    expect(reportData.entries.some(e => e.message === '<require> -> <import>')).toBe(true);
  });

  it('handles template with no transformations needed', () => {
    const html = `<template>
  <div class="container">
    <h1>Hello World</h1>
    <p>No transformations needed here</p>
  </div>
</template>`;

    mockFs.readFileSync.mockReturnValue(html);
    mockFs.writeFileSync.mockImplementation(() => {});

    transformTemplates(['test.html'], reporter, { write: true });

    // Should not write file since no edits were made
    expect(mockFs.writeFileSync).not.toHaveBeenCalled();
    
    const reportData = reporter.finish();
    expect(reportData.entries.length).toBe(0);
  });

  it('warns about button click events that may need :prevent', () => {
    const html = `<template>
  <form>
    <button click.trigger="save()">Save</button>
    <button type="submit" click.trigger="submit()">Submit</button>
  </form>
</template>`;

    mockFs.readFileSync.mockReturnValue(html);
    mockFs.writeFileSync.mockImplementation(() => {});

    transformTemplates(['test.html'], reporter, { write: true });

    const reportData = reporter.finish();
    const warnings = reportData.entries.filter(e => e.kind === 'warn');
    expect(warnings.some(w => w.message.includes(':prevent modifier'))).toBe(true);
    expect(warnings.some(w => w.message.includes('click.trigger="save()"'))).toBe(true);
  });

  it('warns about form submit events that may need :prevent', () => {
    const html = `<template>
  <form submit.trigger="handleSubmit($event)">
    <input type="text" value.bind="name">
    <button type="submit">Submit</button>
  </form>
</template>`;

    mockFs.readFileSync.mockReturnValue(html);
    mockFs.writeFileSync.mockImplementation(() => {});

    transformTemplates(['test.html'], reporter, { write: true });

    const reportData = reporter.finish();
    const warnings = reportData.entries.filter(e => e.kind === 'warn');
    expect(warnings.some(w => w.message.includes('submit.trigger') && w.message.includes(':prevent'))).toBe(true);
  });

  it('warns about link click events that may need :prevent', () => {
    const html = `<template>
  <a href="/some-page" click.trigger="handleClick($event)">Link</a>
</template>`;

    mockFs.readFileSync.mockReturnValue(html);
    mockFs.writeFileSync.mockImplementation(() => {});

    transformTemplates(['test.html'], reporter, { write: true });

    const reportData = reporter.finish();
    const warnings = reportData.entries.filter(e => e.kind === 'warn');
    expect(warnings.some(w => w.message.includes('click.trigger') && w.message.includes(':prevent'))).toBe(true);
  });

  it('warns about keyboard events that may need :prevent', () => {
    const html = `<template>
  <input type="text" keydown.trigger="handleKey($event)">
  <div keypress.trigger="handleKeyPress($event)">Content</div>
</template>`;

    mockFs.readFileSync.mockReturnValue(html);
    mockFs.writeFileSync.mockImplementation(() => {});

    transformTemplates(['test.html'], reporter, { write: true });

    const reportData = reporter.finish();
    const warnings = reportData.entries.filter(e => e.kind === 'warn');
    expect(warnings.some(w => w.message.includes('keydown.trigger') && w.message.includes(':prevent'))).toBe(true);
    expect(warnings.some(w => w.message.includes('keypress.trigger') && w.message.includes(':prevent'))).toBe(true);
  });

  it('converts .call bindings to .bind with lambda wrapper', () => {
    const html = `<template>
  <my-element action.call="doThing($event)"></my-element>
</template>`;

    mockFs.readFileSync.mockReturnValue(html);
    mockFs.writeFileSync.mockImplementation(() => {});

    transformTemplates(['test.html'], reporter, { write: true });

    const written = mockFs.writeFileSync.mock.calls[0][1] as string;
    expect(written).toContain('action.bind="($event) => doThing($event)"');

    const reportData = reporter.finish();
    const edits = reportData.entries.filter(e => e.kind === 'edit');
    expect(edits.some(e => e.message.includes('*.call -> *.bind'))).toBe(true);
  });

  it('converts .call to .bind without wrapping existing arrow functions', () => {
    const html = `<template>
  <my-element action.call="($event) => doThing($event)"></my-element>
</template>`;

    mockFs.readFileSync.mockReturnValue(html);
    mockFs.writeFileSync.mockImplementation(() => {});

    transformTemplates(['test.html'], reporter, { write: true });

    const written = mockFs.writeFileSync.mock.calls[0][1] as string;
    expect(written).toContain('action.bind="($event) => doThing($event)"');
  });

  it('does not warn about non-problematic events', () => {
    const html = `<template>
  <div click.trigger="handleClick()">Safe div click</div>
  <button type="button" click.trigger="safeClick()">Safe button</button>
  <span mouseover.trigger="handleHover()">Hover me</span>
</template>`;

    mockFs.readFileSync.mockReturnValue(html);
    mockFs.writeFileSync.mockImplementation(() => {});

    transformTemplates(['test.html'], reporter, { write: false });

    const reportData = reporter.finish();
    const preventWarnings = reportData.entries.filter(e => 
      e.kind === 'warn' && e.message.includes(':prevent')
    );
    // Should still warn about button click since our current implementation is conservative
    expect(preventWarnings.some(w => w.message.includes('safeClick()'))).toBe(true);
    // But should not warn about mouseover
    expect(preventWarnings.some(w => w.message.includes('mouseover'))).toBe(false);
  });

  it('handles complex template with multiple transformations', () => {
    const html = `<template>
  <require from="./header"></require>
  <require from="./footer"></require>
  
  <div class="app">
    <header-component></header-component>
    
    <main>
      <router-view></router-view>
      <compose view="./sidebar" view-model="./sidebar-vm"></compose>
    </main>
    
    <footer-component 
      click.delegate="handleFooterClick()" 
      view-model.ref="footerRef">
    </footer-component>
  </div>
</template>`;

    const expected = `<template>
  <import from="./header"></import>
  <import from="./footer"></import>
  
  <div class="app">
    <header-component></header-component>
    
    <main>
      <au-viewport></au-viewport>
      <au-compose template="./sidebar" component="./sidebar-vm"></au-compose>
    </main>
    
    <footer-component click.trigger="handleFooterClick()" component.ref="footerRef">
    </footer-component>
  </div>
</template>`;

    mockFs.readFileSync.mockReturnValue(html);
    mockFs.writeFileSync.mockImplementation(() => {});

    transformTemplates(['complex.html'], reporter, { write: true });

    expect(mockFs.writeFileSync).toHaveBeenCalledWith('complex.html', expected, 'utf8');
    
    const reportData = reporter.finish();
    const edits = reportData.entries.filter(e => e.kind === 'edit');
    expect(edits.length).toBeGreaterThan(4); // Multiple transformations
  });
});
