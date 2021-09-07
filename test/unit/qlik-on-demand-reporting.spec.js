import '../../src/qlik-on-demand-reporting';

describe('qlik-on-demand-reporting', () => {
    let definitionFn;
    let $;
    let qlik;
    let properties;
    let hlp;
    let css;
    let viewMain;
    let viewPopup;
    let qvangular;
    let Deferred;
    let FeatureFlags;
    let createComponent;

    beforeAll(() => {
        definitionFn = getDefinitionFn();
    });

    beforeEach(() => {
        $ = () => ({
            html: () => ({ appendTo: () => {} }),
        });
        qlik = {};
        properties = {};
        hlp = {};
        css = {};
        viewMain = {};
        viewPopup = {};
        qvangular = {};
        Deferred = {};
        FeatureFlags = {};

        createComponent = () => definitionFn($, qlik, properties, hlp, css, viewMain, viewPopup, qvangular, Deferred, FeatureFlags);
    });
    
    it('should return definition with correct exposed properties', () => {
        const definition = createComponent();
        expect(Object.keys(definition).sort()).toEqual(['controller', 'definition', 'support', 'template'].sort());
    });
});
