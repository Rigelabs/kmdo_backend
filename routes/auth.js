const { ensureAuth, ensureAdmin, ensureCommittee, ensureActive, ensureRepresentative } = require("../validators/verifytoken");
const Auth = require('../models/Auth');
const cloudinary = require('../middlewares/cloudinary');
const Joi = require('joi');
const { customAlphabet } = require('nanoid/non-secure');
const redisClient = require("../middlewares/redis");
const multer = require('multer');
const express = require('express');
const env = require('dotenv');
const bcrypt = require('bcryptjs');
const logger = require("../middlewares/logger");
const generalrateLimiterMiddleware = require("../middlewares/rateLimiters/genericLimiter");
const jwt = require('jsonwebtoken');
const { RateLimiterRedis } = require('rate-limiter-flexible');
const { AuthDBConnection } = require("../middlewares/mongodb");
const { default: mongoose } = require("mongoose");
const { newUser, sendOTP, sendOTPEmail, newUserNotify, newAccountStatusChange, accountStatusChange } = require("../middlewares/email");


const router = express.Router();

env.config();

const schema = Joi.object({

    full_name: Joi.string().required().max(20).min(3),
    identification_number: Joi.string().required().max(10).min(7),

    contact: Joi.string().required().min(13).max(14).error(new Error("Invalid Phone Number")),
    village: Joi.string().required(),
    email: Joi.string().required().regex(/^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*$/),
    area: Joi.string().required(),
    registration_number: Joi.string().required(),
    occupation: Joi.string().required(),
});
const loginschema = Joi.object({

    contact: Joi.string().required(),
    password: Joi.string().required()
});

const nanoid = customAlphabet('1234567890', 6)
const storage = multer.diskStorage({

    filename: function (req, file, cb) {
        cb(null, nanoid() + '-' + file.originalname)
    },
})
const uploads = multer({
    storage: storage, fileFilter: (req, file, cb) => {
        if (file.mimetype == "image/png" || file.mimetype == "image/jpg" || file.mimetype == "image/jpeg") {
            cb(null, true);
        } else {
            cb(null, false);
            return cb(new Error('Only .png, .jpg and .jpeg format allowed!'));
        }
    }
});
const opts = {
    redis: redisClient,
    points: 5, // 5 points
    duration: 60, // Per minute
    blockDuration: 5 * 60, // block for 5 minutes if more than points consumed 
};

const rateLimiter = new RateLimiterRedis(opts);

const AuthDBCollection = AuthDBConnection.collection("Auth")
//SignUp
router.post('/user/create', async (req, res) => {

    //validate data before adding a user
    try {
        const bodyerror = await schema.validateAsync(req.body);
        const { contact, identification_number, email, registration_number, occupation, full_name,
            village, area } = req.body;
        //check if contact already exist in database

        await AuthDBCollection.findOne({ contact: contact }).then(user_exist => {
            if (user_exist) {
                return res.status(400).json({ message: `User already exist` })
            }

            AuthDBCollection.insertOne({
                full_name: full_name,
                occupation: occupation,
                contact: contact,
                village: village,
                status: "PENDING",
                rank: "MEMBER",
                area: area,
                score: 1.0,
                email: email,
                createdAt: new Date,
                registration_number: registration_number,
                identification_number: identification_number,
                avatar: "https://res.cloudinary.com/dwnxsji2z/image/upload/v1667125758/website%20files/user-avatar_ina40n.png",
                cloudinary_id: "user-avatar_ina40n"
            }).then(saved => {
                newUser(full_name,email);
                newUserNotify(full_name,area,village,occupation,contact,registration_number);
                return res.status(200).json({ message: "Account registered successfully, Please wait for validation" });
            }).catch(error => {
                return (res.status(500).json({ message: "Error saving account, try again" }),
                    logger.error(`Error saving account,${error}`))
            })
        });

    } catch (error) {
        logger.error(`${error.status || 500} - ${req.body.contact} - ${req.body.email} - ${error.message} - ${req.originalUrl} - ${req.method} - ${req.ip}`);
        return res.status(400).json({ message: error.message })
    }





});

router.post('/user/login', async (req, res) => {

    try {
        const { bodyError } = await loginschema.validateAsync(req.body);
        const { contact, password } = req.body;
        if (bodyError) {
            return res.status(400).json({ message: bodyError });
        } else {
            //check if contact  exist in database
            await AuthDBCollection.findOne({ contact: contact }).then(user => {

                if (!user || user.status !== "ACTIVE") {
                    res.status(401).json({ message: "Account doesn't not exist / inactive" })
                } else {
                    //check if password match

                    const validpass = bcrypt.compareSync(password, user.password);
                    if (!validpass) {

                        // Consume 1 point for each failed login attempt
                        rateLimiter.consume(req.socket.remoteAddress)
                            .then((data) => {
                                // Message to user
                                return res.status(400).json({ message: `Invalid Credentials, you have ${data.remainingPoints}  attempts left` });
                            })
                            .catch((rejRes) => {
                                // Blocked
                                const secBeforeNext = Math.ceil(rejRes.msBeforeNext / 60000) || 1;
                                logger.error(`LoggingIn alert: Contact: ${req.body.contact} on IP: ${req.socket.remoteAddress} is Chocking Me !!`)
                                return res.status(429).json({ message: `Too Many Trials, Retry-After ${String(secBeforeNext)} Minutes` });
                            });

                    } else {

                        //create and assign a token once logged in

                        const token = jwt.sign({ _id: user._id, rank: user.rank, status: user.status, area: user.area }, process.env.TOKEN_SECRET, { expiresIn: '1h' })


                        const refreshToken = jwt.sign({ _id: user._id, rank: user.rank, status: user.status, area: user.area }, process.env.REFRESH_TOKEN_SECRET,
                            { expiresIn: '1d' });

                        redisClient.set(user._id.toString(), JSON.stringify({ refreshToken: refreshToken }));

                        const userInfo = {
                            _id: user._id,
                            rank: user.rank,
                            full_name: user.full_name,
                            area: user.area,
                            contact: user.contact,
                            avatar: user.avatar
                        }
                        res.header('token', token).json({ 'token': token, 'refreshToken': refreshToken, 'user': userInfo });

                    }

                }


            });
        }
    } catch (error) {
        res.status(400).json({ message: error.message })
    }
})
//Deleting a Client
router.delete("/user/delete/:id", ensureAdmin, ensureActive, async (req, res) => {
    try {
        //Find user by Id
        const user = await Auth.findById(req.params.user_id);
        if (!user) {
            res.status(400).json({ message: "User not found" })
        }
        //Delete image from cloudinary
        await cloudinary.uploader.destroy(user.cloudinary_id)
        //delete user from mongoDB
        await user.delete();
        res.status(200).json({ message: "Account Deleted successfully" })
    } catch (error) {
        logger.error(`${error.status || 500} - ${req.params.id} - ${error.message} - ${req.originalUrl} - ${req.method} - ${req.ip}`);

    }
});

//Updating user profile
router.put("/user/update", uploads.single("avatar"), ensureAuth, ensureActive, async (req, res) => {

    try {
        await AuthDBCollection.findOne({ contact: req.body.contact }).then(user => {

            if (user) {

                if (req.file) {
                    cloudinary.uploader.upload(req.file.path, {
                        folder: `users/${user.registration_number}/`,
                        secure: true, transformation: [
                            { width: 200, height: 200, gravity: "face", crop: "thumb" }]
                    }).then(result => {

                        const data = {
                            occupation: req.body.occupation ? req.body.occupation : user.occupation,
                            village: req.body.village ? req.body.village : user.village,
                            area: req.body.area ? req.body.area : user.area,
                            email: req.body.email ? req.body.email : user.email,
                            full_name: req.body.full_name ? req.body.full_name : user.full_name,
                            status: req.body.status && req.user.rank === "SUPERADMIN" ? req.body.status : user.status,
                            rank: req.body.rank && req.user.rank === "SUPERADMIN" ? req.body.rank : user.rank,
                            avatar: result ? result.secure_url : user.avatar,
                            cloudinary_id: result ? result.public_id : user.cloudinary_id
                        }
                       
                        AuthDBCollection.findOneAndUpdate({ contact: req.body.contact }, { $set: data },
                            { projection: { 'password': 0 }, returnDocument: "after" }).then(new_user => {
                              
                                if(req.body.status!==user.status){
                                    accountStatusChange(new_user.value.full_name,new_user.value.email,new_user.value.status);
                                }
                                if (new_user.value.status !== "ACTIVE") {
                                    redisClient.del(new_user.value._id.toString());
                                }
                                res.status(200).json(new_user.value);
                            }).catch(error => {

                                res.status(500).json({ message: "Error updating user account" });
                                return logger.error(`Error updating user account, ${req.user.user_id},${error}`);

                            })
                    }).catch(e=>{
                        
                        res.status(403).json({ message: "Error updating account, the selected is bigger than 10MB" });
                        logger.error(`Error updating avatar to cloudinary, ${e.error.message}`)
                    });
                } else {
                    const data = {
                        occupation: req.body.occupation ? req.body.occupation : user.occupation,
                        village: req.body.village ? req.body.village : user.village,
                        area: req.body.area ? req.body.area : user.area,
                        email: req.body.email ? req.body.email : user.email,
                        full_name: req.body.full_name ? req.body.full_name : user.full_name,
                        status: req.body.status && req.user.rank === "SUPERADMIN" ? req.body.status : user.status,
                        rank: req.body.rank && req.user.rank === "SUPERADMIN" ? req.body.rank : user.rank,

                    }

                    AuthDBCollection.findOneAndUpdate({ contact: req.body.contact }, { $set: data },
                        { projection: { 'password': 0 }, returnDocument: "after" }).then(new_user => {
                            res.status(200).json(new_user.value);
                            if (new_user.value.status !== "ACTIVE") {
                                redisClient.del(new_user.value._id.toString());
                            }
                            
                                if(req.body.status!==user.status){
                                    accountStatusChange(new_user.value.full_name,new_user.value.email,user.status,new_user.value.status);
                                }
                        }).catch(error => {

                            res.status(500).json({ message: "Error updating user account" });
                            return logger.error(`Error updating user account, ${req.user.user_id},${error}`);

                        })
                }
            } else {
                return res.status(404).json({ message: "Account not found" });
            }
        }).catch(error => {
            res.status(500).json({ message: "Error retriving user, try again" });
            console.log(error)
            logger.error(`Error retriving user, ${error}`)
        });

    } catch (error) {

        logger.error(`${error.status || 500} - ${res.statusMessage} - ${error.message} - ${req.originalUrl} - ${req.method} - ${req.ip}`);
        res.status(400).json({ message: error.message });
    }
});


//fetch all users for admin
router.get('/users/admin/all', generalrateLimiterMiddleware, ensureAuth, ensureActive, ensureRepresentative, async (req, res, next) => {

    try {
        if (req.user.rank === "ADMIN" || req.user.rank === "SUPERADMIN") {
           
                    //fetch for Auth from DB and cache it
                    AuthDBCollection.find({}, { projection: { "password": 0 },sort:{"createdAt":-1} }).toArray().then((data) => {//fetch all documents

                      
                        return res.status(200).json(data)

                    }).catch(err => {
                        return logger.error(err)
                    })


        } else {
            const area = req.user.area

          
                    //fetch for Auth from DB and cache it
                    AuthDBCollection.find({ 'area': area }, { projection: { "password": 0 } }).toArray().then((data) => {//fetch all documents

                       
                        return res.status(200).json(data)

                    }).catch(err => {
                        return logger.error(err)
                    })
                }
         
    } catch (error) {
        logger.error(`${error.status || 500} - ${res.statusMessage} - ${error.message} - ${req.originalUrl} - ${req.method} - ${req.ip}`);
        return res.status(400).json({ message: error.message })
    }

});
//fetch all users for all
router.get('/users/all', generalrateLimiterMiddleware, ensureAuth, ensureActive, async (req, res, next) => {

    try {

        //fetch for Auth from DB and cache it
        AuthDBCollection.find({}, { projection: { "password": 0},sort:{"createdAt":-1} }).toArray().then((data) => {//fetch all documents


            return res.status(200).json(data)

        }).catch(err => {
            return logger.error(err)
        })

    
          
    } catch (error) {
    logger.error(`${error.status || 500} - ${res.statusMessage} - ${error.message} - ${req.originalUrl} - ${req.method} - ${req.ip}`);
    return res.status(400).json({ message: error.message })
}

});
//search  users for all
router.post('/users/search', generalrateLimiterMiddleware, ensureAuth, ensureActive, async (req, res, next) => {

    try {
        const keyword = req.body.keyword;

        //check data in redisStore
        await redisClient.get(`${keyword}_users`, (err, result) => {
            if (err) {
                console.log(err)
                logger.error(err)
            }
            if (result !== null) {

                return res.status(200).json(JSON.parse(result))
            } else {
                //fetch for Auth from DB and cache it
                AuthDBCollection.find({
                    $or: [
                        { "full_name": new RegExp('.*' + keyword + '.*') },
                        { "area": new RegExp('.*' + keyword + '.*') },
                        { "village": new RegExp('.*' + keyword + '.*') },
                        { "occupation": new RegExp('.*' + keyword + '.*') },
                        { "status": new RegExp('.*' + keyword + '.*') }
                    ]
                },
                    { projection: { "password": 0 },sort:{"createdAt":-1} }).toArray().then((data) => {//fetch all documents

                        redisClient.set(`${keyword}_users`, JSON.stringify(data), 'EX', 600)
                        return res.status(200).json(data)

                    }).catch(err => {
                        return logger.error(err)
                    })

            }
        })
    } catch (error) {
        logger.error(`${error.status || 500} - ${res.statusMessage} - ${error.message} - ${req.originalUrl} - ${req.method} - ${req.ip}`);
        return res.status(400).json({ message: error.message })
    }

});
//get a user
router.get('/user', ensureAuth, ensureActive, async (req, res) => {

    try {
        const user_id = req.user._id

        if (user_id) {
            AuthDBCollection.findOne({ _id: new mongoose.Types.ObjectId(user_id) }, { projection: { "password": 0 } }).then(data => {

                return res.status(200).json(data)
            })
        } else {
            return res.status(400).json({ message: "Invalid request" })
        }
    } catch (error) {
        res.status(500).json({ message: error.message })
        logger.error(`${error.status || 500} - ${res.statusMessage} - ${error.message} - ${req.originalUrl} - ${req.method} - ${req.ip}`);
    }
});

router.post('/user/request_code', async (req, res) => {

    try {
        if (req.body.contact) {

            //check if contact  exist in database
            const user = await AuthDBCollection.findOne({ "contact": req.body.contact });

            if (!user) {
                res.status(400).json({ message: "Account doesn't not exist" });
            } else {
                //send otp and save in the redis db
                const otp_code = nanoid();
                const redisField = `${user.contact}OTP`
                await redisClient.set(redisField.toString(), otp_code.toString(), "EX", 3600, (err, result) => {

                    if (err) {
                        return res.status(400).json({ message: err })
                    }
                    res.status(200).json({ message: `Hello ${user.full_name}, your verification code is: ${otp_code}. Expires in 1 hr` })
                    sendOTPEmail(user.full_name,user.email,otp_code);
                    //twilioSMS(`Hello ${user.full_name}, your verification code is: ${otp_code}. Expires in 3 Minutes`, user.contact).then(reply => {
                    // return res.status(200).json(`Hello ${user.full_name}, your verification code is: ${otp_code}. Expires in 3 Minutes`,)
                    // }).catch(e => { return res.status(400).json({ message: e }) })

                })

            }
        } else {
            res.status(400).json({ message: "Invalid Phone number" })
        }
    } catch (error) {
        res.status(400).json({ message: error.message })
        logger.error(`${error.status || 500} - ${res.statusMessage} - ${error.message} - ${req.originalUrl} - ${req.method} - ${req.ip}`);

    }
});
//verify otpcode and change password
router.post("/user/change_password", async (req, res) => {
    const otp_code = req.body.otp_code
    const contact = req.body.contact
    const password = req.body.password

    try {
        if (otp_code && contact && password) {
            await AuthDBCollection.findOne({ "contact": contact }).then(user => {
                if (!user) {
                    res.status(400).json({ message: "Account doesn't not exist" })
                } else {
                    const string = `${contact}OTP`

                    //compare code in redis with the ones sent
                    redisClient.get(string.toString(), (err, redisData) => {
                        if (err) { res.status(500).json({ message: "Code not verified, request another code" }); return logger.error(err) };

                        if (redisData === null || redisData != otp_code) {
                            // Consume 1 point for each failed login attempt
                            rateLimiter.consume(req.socket.remoteAddress)
                                .then((data) => {
                                    // Message to user
                                    return res.status(400).json({ message: `Invalid Code, you have ${data.remainingPoints} attempts left, Please Request another Code` });
                                })
                                .catch((rejRes) => {
                                    // Blocked
                                    const secBeforeNext = Math.ceil(rejRes.msBeforeNext / 60000) || 1;
                                    logger.error(`LoggingIn alert: Contact: ${req.body.contact} on IP: ${req.socket.remoteAddress} is Chocking Me !!`)
                                    return res.status(429).send(`Too Many Requests, Retry After ${String(secBeforeNext)} Minutes`);
                                });


                        } else {
                            //change password
                            //Hash the password

                            const salt = bcrypt.genSaltSync(10);
                            var hashedPassword = bcrypt.hashSync(req.body.password, salt);
                            const data = {
                                password: hashedPassword
                            }

                            AuthDBCollection.findOneAndUpdate({ "contact": contact }, { $set: data }).then(saved => {
                                //create and assign a token once code is verified

                                const token = jwt.sign({ _id: user._id, rank: user.rank, status: user.status, area: user.area }, process.env.TOKEN_SECRET, { expiresIn: "1h" })


                                const refreshToken = jwt.sign({ _id: user._id, rank: user.rank, status: user.status, area: user.area }, process.env.REFRESH_TOKEN_SECRET,
                                    { expiresIn: '1d' });

                                redisClient.set(user._id.toString(), JSON.stringify({ refreshToken: refreshToken }));
                                //delete otp code from redis
                                redisClient.del(string)

                                const userInfo = {
                                    _id: user._id,
                                    rank: user.rank,
                                    full_name: user.full_name,
                                    area: user.area,
                                    contact: user.contact,
                                    avatar: user.avatar
                                }
                                return (res.header('token', token).json({ 'token': token, 'refreshToken': refreshToken, 'user': userInfo }));
                            }).catch(err => {
                                return res.status(401).json({ message: "Password Change Failed" })
                            })

                        }
                    })

                }
            }).catch(err => {
                res.status(400).json({ message: "Account doesn't not exist" })
            })


        } else {
            return res.status(400).json({ message: "Invalid request, Login again to get another code" })
        }
    } catch (error) {
        return res.status(500).json({ message: error.message })
    }



});

router.post('/user/logout', async (req, res) => {
    try {
        const user_id = req.body.user_id

        //remove refresh token
        await redisClient.del(user_id.toString(), (err, reply) => {
            if (err) {
                return res.status(400).json({ message: err })
            }
            return res.status(200).json({ message: "Logged out successfully" })
        });

        //blacklist the access token
        // await redisClient.set("BL_" + user_id.toString(), 'token')

    } catch (error) {
        logger.error(`${error.status || 500} - ${res.statusMessage} - ${error.message} - ${req.originalUrl} - ${req.method} - ${req.ip}`);
    }

});

module.exports = router;