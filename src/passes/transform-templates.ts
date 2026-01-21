import * as fs from 'node:fs';
import * as path from 'node:path';
import { parseFragment, serialize, DefaultTreeAdapterTypes } from 'parse5';
import { Reporter } from '../types.js';

interface Options {
  write: boolean;
}

function isElement(n: DefaultTreeAdapterTypes.Node): n is DefaultTreeAdapterTypes.Element {
  return (n as any).tagName !== undefined;
}

/**
 * Check if an event handler on a specific element might need preventDefault behavior
 * This helps identify cases where Aurelia 1's automatic preventDefault might be missed in v2
 */
function isPotentiallyProblematicEvent(element: DefaultTreeAdapterTypes.Element, eventName: string, eventValue: string): boolean {
  const tagName = element.tagName.toLowerCase();
  
  // Form submission events on buttons inside forms
  if (eventName === 'click' && tagName === 'button') {
    // Check if button is inside a form or has type="submit"
    const typeAttr = element.attrs.find(attr => attr.name === 'type');
    if (typeAttr?.value === 'submit' || isInsideForm(element)) {
      return true;
    }
  }
  
  // Form submission events
  if (eventName === 'submit' && tagName === 'form') {
    return true;
  }
  
  // Link navigation events that might need prevention
  if (eventName === 'click' && tagName === 'a') {
    const hrefAttr = element.attrs.find(attr => attr.name === 'href');
    // If there's an href but we're handling click, might need preventDefault
    if (hrefAttr && hrefAttr.value && !hrefAttr.value.startsWith('javascript:')) {
      return true;
    }
  }
  
  // Key events that commonly need preventDefault (like Enter in forms)
  if (eventName === 'keydown' || eventName === 'keyup' || eventName === 'keypress') {
    return true;
  }
  
  return false;
}

/**
 * Check if an element is inside a form (simplified check - only looks at direct ancestors)
 */
function isInsideForm(element: DefaultTreeAdapterTypes.Element): boolean {
  // This is a simplified check - in a full implementation we'd walk up the DOM tree
  // For now, we'll be conservative and assume buttons might be in forms
  return true; // Conservative approach - warn about all button clicks
}

export function transformTemplates(files: string[], reporter: Reporter, options: Options) {
  for (const file of files) {
    const html = fs.readFileSync(file, 'utf8');
    const doc = parseFragment(html, { sourceCodeLocationInfo: true });
    let edits = 0;
    let warnings = 0;

    function visit(node: DefaultTreeAdapterTypes.Node) {
      if (isElement(node)) {
        // tag transforms
        if (node.tagName === 'require') {
          node.tagName = 'import';
          edits++;
          reporter.edit(file, '<require> -> <import>');
        }
        if (node.tagName === 'router-view') {
          node.tagName = 'au-viewport';
          edits++;
          reporter.edit(file, '<router-view> -> <au-viewport>');
        }
        if (node.tagName === 'compose') {
          node.tagName = 'au-compose';
          edits++;
          reporter.edit(file, '<compose> -> <au-compose>');
          for (const a of node.attrs) {
            if (a.name === 'view') a.name = 'template';
            if (a.name === 'view-model') a.name = 'component';
          }
        }

        for (const a of node.attrs) {
          if (a.name.endsWith('.delegate')) {
            a.name = a.name.replace('.delegate', '.trigger');
            edits++;
            reporter.edit(file, '*.delegate -> *.trigger');
          }
          if (a.name === 'view-model.ref') {
            a.name = 'component.ref';
            edits++;
            reporter.edit(file, 'view-model.ref -> component.ref');
          }
          if (a.name.endsWith('.call')) {
            const base = a.name.slice(0, -'.call'.length);
            a.name = `${base}.bind`;
            const value = a.value.trim();
            if (value.includes('=>')) {
              reporter.edit(file, '*.call -> *.bind (kept existing arrow function)');
            } else {
              a.value = `($event) => ${value}`;
              reporter.edit(file, '*.call -> *.bind with lambda wrapper');
            }
            edits++;
          }
          
          // Check for event handlers that may need :prevent modifier in Aurelia 2
          if (a.name.endsWith('.trigger') || a.name.endsWith('.delegate')) {
            const eventName = a.name.split('.')[0];
            const eventValue = a.value;
            
            // Check if this is a potentially problematic event handler
            if (isPotentiallyProblematicEvent(node, eventName, eventValue)) {
              warnings++;
              reporter.warn(file, `Event handler '${a.name}="${eventValue}"' may need :prevent modifier in Aurelia 2. In v1, preventDefault was called automatically, but not in v2. Consider '${eventName}.trigger:prevent' if needed.`);
            }
          }
        }
      }
      // recurse
      const anyNode = node as any;
      if (Array.isArray(anyNode.childNodes)) {
        for (const child of anyNode.childNodes) visit(child);
      }
      if (Array.isArray((anyNode as any).content?.childNodes)) {
        for (const child of (anyNode as any).content.childNodes) visit(child);
      }
    }

    visit(doc as DefaultTreeAdapterTypes.Node);

    if (edits > 0 && options.write) {
      fs.writeFileSync(file, serialize(doc as any), 'utf8');
    }
  }
}
