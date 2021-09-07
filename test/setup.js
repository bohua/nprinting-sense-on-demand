let recentFn;

global.define = jest.fn().mockImplementation((strings, fn) => {
  recentFn = fn;
});

global.getDefinitionFn = () => recentFn;
