const mongoose = require('mongoose');
const env = require('dotenv');
const logger = require('./logger');


env.config();

//connecting to Auth  db

const AuthDBConnection = mongoose.createConnection(process.env.AUTH_URI, { useNewUrlParser: true, useUnifiedTopology: true, connectTimeoutMS: 60000 })
AuthDBConnection.once("open", function () {
    console.log(`Connected to Auth DB, ${new Date}`)
})
AuthDBConnection.on('disconnected', err => {
    console.log('Auth DB disconnected'),
        logger.error(`Auth DB disconnected  ${err}, ${new Date}`)
})
AuthDBConnection.on('reconnected', err => {
    console.log('Auth DB reconnected'),
        logger.info('Auth DB reconnected')
})
AuthDBConnection.on('error', err => {
    console.log(' DB Error', err),
        logger.error(` DB Error',  ${err}, ${new Date}`)
})
//connecting to Auth  db

const VillageConnection = mongoose.createConnection(process.env.VILLAGES_URI, { useNewUrlParser: true, useUnifiedTopology: true, connectTimeoutMS: 60000 })
VillageConnection.once("open", function () {
    console.log(`Connected to Villages DB, ${new Date}`)
})
VillageConnection.on('disconnected', err => {
    console.log('Villages DB disconnected'),
        logger.error(`Villages DB disconnected  ${err}, ${new Date}`)
})
VillageConnection.on('reconnected', err => {
    console.log('Villages DB reconnected'),
        logger.info('Villages DB reconnected')
})
VillageConnection.on('error', err => {
    console.log('Villages DB Error', err),
        logger.error(`Villages DB Error',  ${err}, ${new Date}`)
})

//connecting to Auth  db

const AreaConnection = mongoose.createConnection(process.env.AREAS_URI, { useNewUrlParser: true, useUnifiedTopology: true, connectTimeoutMS: 60000 })
AreaConnection.once("open", function () {
    console.log(`Connected to Area DB, ${new Date}`)
})
AreaConnection.on('disconnected', err => {
    console.log('Area DB disconnected'),
        logger.error(`Area DB disconnected  ${err}, ${new Date}`)
})
AreaConnection.on('reconnected', err => {
    console.log('Area DB reconnected'),
        logger.info('Area DB reconnected')
})
AreaConnection.on('error', err => {
    console.log('Area DB Error', err),
        logger.error(`Area DB Error',  ${err}, ${new Date}`)
});

const ReportsConnection = mongoose.createConnection(process.env.REPORTS_MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true, connectTimeoutMS: 60000 })
ReportsConnection.once("open", function () {
    console.log(`Connected to Reports DB, ${new Date}`)
})
ReportsConnection.on('disconnected', err => {
    console.log('Reports DB disconnected'),
        logger.error(`Reports DB disconnected  ${err}, ${new Date}`)
})
ReportsConnection.on('reconnected', err => {
    console.log('Reports DB reconnected'),
        logger.info('Reports DB reconnected')
})
ReportsConnection.on('error', err => {
    console.log('Reports DB Error', err),
        logger.error(`Reports DB Error',  ${err}, ${new Date}`)
})
module.exports = {
    AuthDBConnection,VillageConnection,AreaConnection,ReportsConnection
};

