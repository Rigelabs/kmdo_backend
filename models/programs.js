const mongoose=require('mongoose')

const ProgramsSchema = new mongoose.Schema({
    //atributes
   
    name:{
        type:String, 
    },
    start_date:{
        type:Date,
       
    },
    end_date:{
        type:Date,
       
    },
    target:{
        type:Number,
    },
    description:{
        type:String,
       
    },
    
})

module.exports=mongoose.model('Programs',ProgramsSchema)
