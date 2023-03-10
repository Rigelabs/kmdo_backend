const express = require('express');
const { default: mongoose } = require('mongoose');
const logger = require('../middlewares/logger');
const { ProgramsConnection } = require('../middlewares/mongodb');

const { ensureCommittee, ensureAuth } = require('../validators/verifytoken');

const router = express.Router();
const ProgramsCollection=ProgramsConnection.collection("programs");


router.post('/create', async (req, res) => {

    //validate data before adding a user
    try {
           const { name,start_date,end_date,target,description,image_url,pillar} = req.body;
        //check if contact already exist in database

        await ProgramsCollection.findOne({name: name}).then(program => {
            if (program) {
                return res.status(400).json({ message: `The program already exist` })
            }
            ProgramsCollection.insertOne({
                    name: name,
                    start_date:start_date,
                    end_date:end_date,
                    target:target,
                    description:description,
                    image_url:image_url,
                    pillar:pillar
                }).then(saved=>{
                    ProgramsCollection.find({}).toArray().then(programs=>{
                        return res.status(200).json(programs);
                    })
                
            });
        });
    } catch (error) {
        logger.error(`${error.status || 500} - ${req.body.contact} - ${req.body.email} - ${error.message} - ${req.originalUrl} - ${req.method} - ${req.ip}`);
        return res.status(400).json({ message: error.message })
    }
});

router.post('/program/update', async (req, res) => {

    //validate data before adding a user
    try {
       
        const { program_id,name,start_date,end_date,target,description } = req.body;
        //check if contact already exist in database
        
        await ProgramsCollection.findOne({_id: mongoose.Types.ObjectId(program_id)}).then(program => {
            if (!program) {
                return res.status(400).json({ message: `The program doesn't exist` })
            }
          
                const data={
                    name: name ? name :program.name,
                    start_date:start_date ? start_date : program.start_date,
                    end_date:end_date ? end_date : program.end_date,
                    target:target ? target :program.target,
                    description:description ? description :program.description
                }
                
                ProgramsCollection.findOneAndUpdate({_id: mongoose.Types.ObjectId(program_id)},{ $set: data },
                    { returnDocument: "after" }).then(new_program=>{
                        
                        ProgramsCollection.find({}).toArray().then(programs=>{
                            return res.status(200).json(programs);
                        })
            });
        });
    } catch (error) {
        logger.error(`${error.status || 500} - ${req.body.contact} - ${req.body.email} - ${error.message} - ${req.originalUrl} - ${req.method} - ${req.ip}`);
        return res.status(400).json({ message: error.message })
    }
});
router.get("/all", async (req, res) => {
    await ProgramsCollection.find().toArray().then(programs=>{
        res.status(200).json(programs);
    })
});


module.exports=router;