module.exports = {
    apps: [{
        name: 'uranus-control',
        script: 'server.mjs',
        instances: 'max',
        autorestart: true,
        watch: false,
        env: {
            NODE_ENV: 'production',
            PORT: 3388
        }
    }]
};
