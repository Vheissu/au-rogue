import { autoinject, valueConverter } from 'aurelia-framework';

@valueConverter('dateFormat')
@autoinject
export class DateFormatValueConverter {
  toView(value: string | Date, format?: string): string {
    if (!value) return '';
    
    const date = typeof value === 'string' ? new Date(value) : value;
    
    switch (format) {
      case 'short':
        return date.toLocaleDateString();
      case 'long':
        return date.toLocaleDateString('en-US', { 
          weekday: 'long', 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        });
      case 'time':
        return date.toLocaleTimeString();
      default:
        return date.toLocaleString();
    }
  }
}