const { getCsatByToken, submitCsatByToken } = require('../../../lib/csat-repository');

export default async function handler(req,res){
  try{
    if(req.method==='GET'){
      const survey=await getCsatByToken(req.query.token);
      if(!survey)return res.status(404).json({success:false,message:'Survey link is invalid or expired.'});
      return res.json({success:true,survey});
    }
    if(req.method==='POST'){
      const survey=await submitCsatByToken({token:req.query.token,input:req.body||{}});
      if(!survey)return res.status(404).json({success:false,message:'Survey link is invalid or expired.'});
      return res.json({success:true,survey});
    }
    res.setHeader('Allow','GET, POST');return res.status(405).json({success:false,message:'Method not allowed'});
  }catch(error){return res.status(400).json({success:false,message:error.message||'Unable to submit satisfaction survey.'});}
}
