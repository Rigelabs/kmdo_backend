const Users =require('../../models/users');
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken');
const Joi = require('joi');
const {RateLimiterRedis,RateLimiterMemory} =require('rate-limiter-flexible');
const logger = require('../logger');
const redisClient = require('../redis');


const token_key = process.env.TOKEN_SECRET;

const loginschema = Joi.object({

    contact: Joi.string().required(),
    password: Joi.string().required()
});
//RateLimiting to prevent brute-force attacks from an IP
//using RedisRateLimiter
const redisRateLimiterClient = redisClient;

// It is recommended to process Redis errors and setup some reconnection strategy
redisRateLimiterClient.on('error', (err) => {
  logger.error('Redis connection error: ',err)
});

const maxWrongAttemptsByIPperDay = 100;
const maxConsecutiveFailsByUsernameAndIP = 10;

const limiterSlowBruteByIP = new RateLimiterRedis({
    storeClient: redisRateLimiterClient,
    keyPrefix: 'login_fail_ip_per_day',
    points: 10,
    duration: 60*10,
    blockDuration: 60 * 60 * 24, // Block for 1 day, if 100 wrong attempts per day
    //inmemoryBlockOnConsumed: 100, // If 100 points consumed
    //inmemoryBlockDuration: 30, // block for 30 seconds
   
  });
  
  const limiterConsecutiveFailsByUsernameAndIP = new RateLimiterRedis({
    storeClient: redisRateLimiterClient,
    keyPrefix: 'login_fail_consecutive_username_and_ip',
    points: 10,
    duration: 60*10, // Store number for 10mins since first fail
    blockDuration: 60*2, // Block for 1 minute after consecutive fails
    //inmemoryBlockOnConsumed: 200, // If 200 points consumed
    //inmemoryBlockDuration: 30, // block for 30 seconds
    //insuranceLimiter: new RateLimiterMemory(
       // {
       //   points: 20, // 20 is fair if you have 5 workers and 1 cluster
       //   duration: 1,
       // }),
  });
const getUsernameIpKey =(username, ip)=> `${username}_${ip}`;

async function loginLimiter(req,res,next){
    const ipAddr = req.connection.remoteAddress;
 
    const usernameIPKey = getUsernameIpKey(req.body.contact, ipAddr);
    
    const [resUsernameAndIP,resSlowByIP]= await Promise.all([
        limiterConsecutiveFailsByUsernameAndIP.get(usernameIPKey),
        limiterSlowBruteByIP.get(ipAddr)
    ]);

    let retrySecs = 0;
    //check if IP or Username + IP is blocked
    if(resSlowByIP !== null && resSlowByIP.consumedPoints > maxWrongAttemptsByIPperDay){
        retrySecs = Math.round(resSlowByIP.msBeforeNext / 1000) || 1;
    }

    if(retrySecs >0){
       logger.error("I am Choking, too many requests",usernameIPKey)
        res.status(429).json({message:"I am Choking, too many requests"});
    }else{
        let user = null;
        let validpass=null;
        let token=null;
        try{
            const {bodyError,value} = await loginschema.validateAsync(req.body);
            if(bodyError){
                res.status(400).json({message: bodyError});
            }else{
                //check if contact  exist in database
                 user =await Users.findOne({contact: req.body.contact});
                 
                 if (!user){
                         res.status(400).json({message:"Account doesn't not exist"})
                    }else{
                        //check if role is Admin
                        
                           
                                    //check if password match
        
                             validpass =await bcrypt.compare(req.body.password,user.password);
                            if(!validpass) return  res.status(400).json({message:"Invalid Credentials"});
    
                             //create and assign a token once logged in
                         
                             token =jwt.sign({_id:user._id,  role:user.role},token_key,{expiresIn:120})
                            
                         
                             const refreshToken =jwt.sign({data:user._id},process.env.REFRESH_TOKEN_SECRET,
                                {expiresIn:1440});

                           await redisClient.get(user._id.toString(),(err,data)=>{
                                if(err) throw err;
                                if(!data){
                                redisClient.set(user._id.toString(),JSON.stringify({token:refreshToken}));
                                }
                            })
                             const userInfo={
                                _id:user._id, 
                                role:user.role,
                                username: user.role,
                                contact:user.contact,
                                avatar: user.avatar
                             }
                            res.header('token', token).json({'token':token,'refreshToken': refreshToken,'user':userInfo});
    
                            
       
                    }
        
            }
        }catch(error){
            res.status(400).json({message:error.message})
        }
       
        if(!validpass){
             // Consume 1 point from limiters on wrong attempt and block if limits reached
            try {
                const promises = [limiterSlowBruteByIP.consume(ipAddr)];
                if (user) {
                     // Count failed attempts by Username + IP only for registered users
                     promises.push(limiterConsecutiveFailsByUsernameAndIP.consume(usernameIPKey));
                }
                await Promise.all(promises);
            
            } catch (rlRejected) {
                if(rlRejected instanceof Error){
                    logger(rlRejected)
                   throw rlRejected
                   
                }else{
                    
                     res.status(429).send('Too Many Requests');
                }
            }
        }
        if(validpass && token){
            if (resUsernameAndIP !== null && resUsernameAndIP.consumedPoints > 0) {
                // Reset on successful authorisation
                await limiterConsecutiveFailsByUsernameAndIP.delete(usernameIPKey);
              }
        
             
        }
    }
}


module.exports=loginLimiter;