const mongoose=require('mongoose')

const AreaSchema = new mongoose.Schema({
    //atributes
   
    name:{
        type:String, 
    },
    representative:{
        type:String,
       
    },
    
})

module.exports=mongoose.model('Area',AreaSchema)
