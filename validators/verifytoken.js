const jwt = require('jsonwebtoken');
const logger = require('../middlewares/logger');
const redisClient = require('../middlewares/redis');

module.exports ={
    ensureAuth: function(req,res,next){
      
        const authHeader= req.headers['authorization'];
        
        try {
           
            if (authHeader){
                const bearer=authHeader.split(' ');
                const token = bearer[1];
                
                const user = jwt.verify(token, process.env.TOKEN_SECRET) 
               
                req.user =user;

                next();
            }else{
                logger.error(`Invalid request ${req.originalUrl} - ${req.method} - ${req.ip}`);
               return res.status(403).json({message:"Authentication failed,login to proceed"})
            }
        } catch (error) {
            if (error.name==='TokenExpiredError') {
                return res.status(401).send({ message: "Your Session expired, You need to Login Again !" });
            
            }return res.status(401).json({message: "Authentication failed,login to proceed"})
        }
        
    }, 
    verifyRefreshToken: async function(req,res,next){
        
        const refreshToken= req.body.refreshToken
        const user_id= req.body.user_id
        try {
            if (refreshToken && user_id){
            
               jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET,async function(err,decoded){
                    if(err){
                    
                    if (err.name==='TokenExpiredError') {
                       await redisClient.del(user_id.toString(), (err,reply)=>{
                           if(err) return logger.error("token not deleted", err)
                           
                       })
                       return res.status(401).send({ message: "Your Session expired, You need to Login Again !" });
                   }}
                   if(decoded._id){
                   
                    //verify if refreshtoken is on redis store
                   await redisClient.get(decoded._id.toString(), (err,data)=>{
                        if(err){ return (res.status(500).json({message:err}),logger.error(err))};
                       
                        if(data ===null) return  res.status(404).json({message:"No Token in store, Please Login again"});

                        if(JSON.parse(data).refreshToken != refreshToken) return  res.status(401).json({message:"Unathorized operation"});

                        //create and assign a refresh token and access token

                     const token = jwt.sign({ _id: decoded._id, rank: decoded.rank }, process.env.TOKEN_SECRET, { expiresIn: 120 })


                     const newRefreshToken = jwt.sign({ _id: decoded._id,rank: decoded.rank }, process.env.REFRESH_TOKEN_SECRET,
                            { expiresIn: '1d' });

                 redisClient.set(decoded._id.toString(), JSON.stringify({ refreshToken: newRefreshToken }));
                 res.header('token', token).json({ 'token': token, 'refreshToken': newRefreshToken});
                    })
              }
               })
            }else{
               return res.status(401).json({message:"No Refresh token or User ID"})
            }
        } catch (error) {
           
            return res.status(400).json({message: error.message})      
            }
        
        
    }, 
        
    ensureAdmin: function(req,res,next){
        const {rank} = req.user;
        if(rank !== "ADMIN"){
            return res.status(403).json({message:"Unathorized operation !"})
        }else{
            return next()
        }
    },
          
    ensureActive: function(req,res,next){
        const {status} = req.user;
        if(status !== "ACTIVE"){
            return res.status(403).json({message:"User account is inactive, contact your area representative"})
        }else{
            return next()
        }
    },   
    ensureCommittee: function(req,res,next){
        const {rank} = req.user;
        if(rank === "MEMBER"){
            return res.status(403).json({message:"Unathorized operation !"})
        }else{
            return next()
        }
    },
        
    ensureRepresentative: function(req,res,next){
        const {rank} = req.user;
        if(rank === "REPRESENTATIVE" || rank === "ADMIN"){
            return next()
        }else{
            return res.status(403).json({message:"Unathorized operation !"})
          
        }
    },
}