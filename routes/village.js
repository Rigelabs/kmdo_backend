const express = require('express');
const { default: mongoose } = require('mongoose');
const logger = require('../middlewares/logger');
const { VillageConnection, AreaConnection } = require('../middlewares/mongodb');

const { ensureCommittee, ensureAuth } = require('../validators/verifytoken');

const router = express.Router();
const VillageCollection=VillageConnection.collection("Villages");
const AreaCollection=AreaConnection.collection("Areas")

router.post('/create', async (req, res) => {

    //validate data before adding a user
    try {
           const { name } = req.body;
        //check if contact already exist in database

        await VillageCollection.findOne({name: name}).then(village => {
            if (village) {
                return res.status(400).json({ message: `The Village already exist` })
            }
            VillageCollection.insertOne({
                    name: name,
                   
                }).then(saved=>{
                    VillageCollection.find({}).toArray().then(villages=>{
                        return res.status(200).json(villages);
                    })
                
            });
        });
    } catch (error) {
        logger.error(`${error.status || 500} - ${req.body.contact} - ${req.body.email} - ${error.message} - ${req.originalUrl} - ${req.method} - ${req.ip}`);
        return res.status(400).json({ message: error.message })
    }
});
router.post('/area/create', async (req, res) => {

    //validate data before adding a user
    try {
       
        const { name,village,representative } = req.body;
        //check if contact already exist in database

        await AreaCollection.findOne({name: name}).then(area => {
            if (area) {
                return res.status(400).json({ message: `The area already exist` })
            }
                AreaCollection.insertOne({
                    name: name,
                    village:village,
                    representative:representative
                }).then(saved=>{
                    AreaCollection.find({}).toArray().then(areas=>{
                        return res.status(200).json(areas);
                    })
               
            });
        });
    } catch (error) {
        logger.error(`${error.status || 500} - ${req.body.contact} - ${req.body.email} - ${error.message} - ${req.originalUrl} - ${req.method} - ${req.ip}`);
        return res.status(400).json({ message: error.message })
    }
});
router.post('/area/update', async (req, res) => {

    //validate data before adding a user
    try {
       
        const { area_id,name,village,representative } = req.body;
        //check if contact already exist in database
        
        await AreaCollection.findOne({_id: mongoose.Types.ObjectId(area_id)}).then(area => {
            if (!area) {
                return res.status(400).json({ message: `The area doesn't exist` })
            }
          
                const data={
                    name: name ? name :area.name,
                    village:village ? village : area.village,
                    representative:representative ? representative :area.representative
                }
                
                AreaCollection.findOneAndUpdate({_id: mongoose.Types.ObjectId(area_id)},{ $set: data },
                    { returnDocument: "after" }).then(new_area=>{
                        
                        AreaCollection.find({}).toArray().then(areas=>{
                            return res.status(200).json(areas);
                        })
            });
        });
    } catch (error) {
        logger.error(`${error.status || 500} - ${req.body.contact} - ${req.body.email} - ${error.message} - ${req.originalUrl} - ${req.method} - ${req.ip}`);
        return res.status(400).json({ message: error.message })
    }
});
router.get("/all", async (req, res) => {
    await VillageCollection.find().toArray().then(villages=>{
        res.status(200).json(villages);
    })
});
router.get("/areas/all", async (req, res) => {
    await AreaCollection.find().toArray().then(areas=>{
        res.status(200).json(areas);
    })
});

module.exports=router;