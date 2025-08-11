import { Aurelia } from 'aurelia-framework';
import { PLATFORM } from 'aurelia-pal';

export function configure(aurelia: Aurelia) {
  aurelia.use
    .standardConfiguration()
    .plugin('aurelia-validation')
    .plugin('aurelia-i18n', (instance) => {
      return instance.setup({
        resources: {
          en: {
            translation: {
              title: 'Hello world!'
            }
          }
        },
        lng: 'en',
        fallbackLng: 'en',
        debug: false
      });
    })
    .plugin('aurelia-dialog')
    .plugin('custom-legacy-plugin')
    .feature(PLATFORM.moduleName('resources/index'));

  if (environment.debug) {
    aurelia.use.developmentLogging();
  }

  if (environment.testing) {
    aurelia.use.plugin(PLATFORM.moduleName('aurelia-testing'));
  }

  aurelia.start().then(() => aurelia.setRoot('app'));
}