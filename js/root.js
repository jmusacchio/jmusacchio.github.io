requirejs.config({
    baseUrl: '/js/lib',
    paths: {
        app: '/js/app'
    },
    shim: {
        'bootstrap': ['jquery'],
        'function-plot': ['d3']
    }
});

requirejs(['bootstrap', 'function-plot', 'app/root']);