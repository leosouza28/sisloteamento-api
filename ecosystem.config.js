module.exports = {
    apps: [
        {
            name: 'dreamsloteamento-api',
            script: './dist/tasks.js',
            autorestart: true,
            env: {
                NODE_ENV: 'development'
            },
        }
    ]
};