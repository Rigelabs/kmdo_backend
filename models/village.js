const mongoose=require('mongoose')

const VillageSchema = new mongoose.Schema({
  
    name:{
        type:String,
        allowNull:false, 
    },
    
})

module.exports=mongoose.model('Village',VillageSchema)
