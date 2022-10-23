const { RateLimiterRedis,RateLimiterMemory } = require('rate-limiter-flexible');
const Redis = require('redis');// It is recommended to process Redis errors and setup some reconnection strategy
const logger = require('../logger');
const redisClient = require('../redis');


const redisClientRateLimiter = redisClient;

const opts = {
  storeClient: redisClientRateLimiter,
  keyPrefix: 'generic_fail_ip_per_day',
    points: 100,// number of points
    duration: 60,//per 60seconds
    blockDuration: 60*60, // Block for 1 day, if all points are consumed in i minute
   
};

const rateLimiterRedis = new RateLimiterRedis(opts);

const generalrateLimiterMiddleware = (req, res, next) => {
      rateLimiterRedis.consume(req.connection.remoteAddress,2)
        .then((rateLimiterRes) => {
         next();
         })
          .catch((rejRes) => {
            if(rejRes instanceof Error){
              logger.error("Redis Error in Generic limiter", rejRes)
            }else{
              res.status(429).json({message:'Too Many Requests'});
            const secs = Math.round(rejRes.msBeforeNext / 1000) || 1;
            logger.warn(` Retry-After - ${String(secs)} Seconds - ${res.statusMessage}-${rejRes.status || 429} - ${req.originalUrl} - ${req.method} - ${req.ip}`)
            }
          });
  
          
      };

module.exports =generalrateLimiterMiddleware;