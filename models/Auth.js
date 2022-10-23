const mongoose=require('mongoose')

const AuthSchema = new mongoose.Schema({
    //atributes
   
    email:{
        type: String,
        unique:true,
        required:true,
        
    },
    village:{
        type: String,
       
    },
    area:{
        type: String,
       
    },
    full_name:{
        type:String,
        required:true,
       
    },
    
    identification_number:{
        type:String,
        unique:true,
        required:true,
    },
    registration_number:{
        type:String,
        unique:true,
        required:true,
    },
    contact:{
        type:String,
        required:true,
        unique:true
    },
    occupation:{
        type:String,
     
    },
    status:{
        type:String,
        default:"PENDING",
        enum:["PENDING","ACTIVE","SUSPENDED"]  
    },
    score:{
        type:Number,   
        defaultValue:1,
          
    },
    avatar:{
        type:String,
        default:"https://res.cloudinary.com/dfnuodjiw/image/upload/v1650034813/logos/construction_woman_bmlnma.jpg"
          
    },
    avatar_cloudinary_id: {
        type:String,
        default:"construction_woman_bmlnma"
              
    },
    
    rank:{
        type:String,
       default:"MEMBER",
        enum:["ADMIN","REPRESENTATIVE","COMMITTEE","MEMBER"]  
    },
},{timestamps:true})

module.exports=mongoose.model('Auth',AuthSchema)
