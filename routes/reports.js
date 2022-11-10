const express = require('express');
const logger = require('../middlewares/logger');
const { VillageConnection, AreaConnection, ReportsConnection } = require('../middlewares/mongodb');

const { ensureCommittee, ensureAuth, ensureActive, ensureAdmin } = require('../validators/verifytoken');

const router = express.Router();
const ReportsCollection=ReportsConnection.collection("Reports");


router.post('/create', ensureAuth, ensureActive, ensureAdmin,async (req, res) => {

   
    try {
       
        const { title,link } = req.body;
        if(title && link){
        await ReportsCollection.findOne({title: title}).then(report => {
            if (report) {
                return res.status(400).json({ message: `The report already exist` })
            }
            ReportsCollection.insertOne({
                    title: title,
                    link:link,
                    createdAt:new Date
                }).then(saved=>{

                return res.status(200).json({ message: "Report registered successfully" });
            });
        });
        }else{
            res.status(400).json({message:"Invalid request"});
        }
    } catch (error) {
        logger.error(`Error creating report, ${error}`);
        return res.status(400).json({ message: error.message })
    }
});
router.get("/all", async (req, res) => {
    await ReportsCollection.find({},{sort:{"createdAt":-1}}).toArray().then(reports=>{
        res.status(200).json(reports);
    })
});
module.exports=router;