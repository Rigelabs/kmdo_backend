const { ensureAuth, ensureAdmin, ensureCommittee, ensureActive, ensureRepresentative, ensureSuperAdmin } = require("../validators/verifytoken");
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
    contact: Joi.string().required().min(13).max(14).error(new Error("Invalid Phone Number")),
    village: Joi.string().required(),
    email: Joi.string().required().regex(/^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*$/),
    area: Joi.string().required(),
    registration_number: Joi.string().required(),
    role: Joi.string().required(),
    avatar: Joi.string(),
});


const AuthDBCollection = AuthDBConnection.collection("Board")
//SignUp
router.post('/add/member', async (req, res) => {

    //validate data before adding a user
    try {
        const bodyerror = await schema.validateAsync(req.body);
        const { contact, email, registration_number, full_name, role,
            avatar, village, area } = req.body;
        //check if contact already exist in database

        await AuthDBCollection.findOne({ registration_number: registration_number }).then(user_exist => {
            if (user_exist) {
                return res.status(400).json({ message: `Board member already exist` })
            }

            AuthDBCollection.insertOne({
                full_name: full_name,
                role: role,
                contact: contact,
                village: village,
                area: area,
                email: email,
                createdAt: new Date,
                registration_number: registration_number,
                avatar: avatar
            }).then(saved => {
                AuthDBCollection.find({}).toArray().then(board_members => {
                    return res.status(200).json(board_members);
                })

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


//remove a board member
router.post("/remove/:registration_number", ensureAuth,ensureActive, ensureSuperAdmin, async (req, res) => {
    try {
        //Find user by Id
         await AuthDBCollection.findOneAndDelete({ registration_number: req.params.registration_number }).then(deleted=>{
            AuthDBCollection.find({}).toArray().then(board_members => {
                return res.status(200).json(board_members);
            })
         });
        
    } catch (error) {
        logger.error(`${error.status || 500} - ${req.params.id} - ${error.message} - ${req.originalUrl} - ${req.method} - ${req.ip}`);

    }
});

//Updating user profile
router.put("/member/update/:id",ensureAuth,ensureActive, ensureSuperAdmin, async (req, res) => {

    try {
        await AuthDBCollection.findOne({ registration_number: req.params.id }).then(user => {

            if (user) {
                const data = {

                    village: req.body.village ? req.body.village : user.village,
                    area: req.body.area ? req.body.area : user.area,
                    email: req.body.email ? req.body.email : user.email,
                    full_name: req.body.full_name ? req.body.full_name : user.full_name,
                    status: req.body.status ? req.body.status : user.status,
                    role: req.body.role ? req.body.role : user.role,

                }

                AuthDBCollection.findOneAndUpdate({ registration_number: req.params.id }, { $set: data },
                    { returnDocument: "after" }).then(new_user => {

                        AuthDBCollection.find({}).toArray().then((data) => {//fetch all documents


                            return res.status(200).json(data)

                        }).catch(err => {
                            return logger.error(err)
                        })

                    }).catch(error => {

                        res.status(500).json({ message: "Error updating board member account" });
                        return logger.error(`Error updating board member account, ${req.user.user_id},${error}`);

                    })

            } else {
                return res.status(404).json({ message: "Account not found" });
            }
        }).catch(error => {
            res.status(500).json({ message: "Error retriving member, try again" });
            console.log(error)
            logger.error(`Error retriving member, ${error}`)
        });

    } catch (error) {

        logger.error(`${error.status || 500} - ${res.statusMessage} - ${error.message} - ${req.originalUrl} - ${req.method} - ${req.ip}`);
        res.status(400).json({ message: error.message });
    }
});


//fetch all board members for admin
router.get('/all', generalrateLimiterMiddleware,  async (req, res, next) => {

    try {

        //fetch for Auth from DB and cache it
        AuthDBCollection.find({}).toArray().then((data) => {//fetch all documents


            return res.status(200).json(data)

        }).catch(err => {
            return logger.error(err)
        })


    } catch (error) {
        logger.error(`${error.status || 500} - ${res.statusMessage} - ${error.message} - ${req.originalUrl} - ${req.method} - ${req.ip}`);
        return res.status(400).json({ message: error.message })
    }

});



module.exports = router;