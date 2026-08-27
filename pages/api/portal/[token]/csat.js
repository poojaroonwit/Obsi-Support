const { getCsatForPortalToken, submitCsatByPortalToken } = require('../../../../lib/csat-repository');

export default async function handler(req,res){
  try{
    if(req.method==='GET') return res.json({success:true,csat:await getCsatForPortalToken(req.query.token)});
    if(req.method==='POST'){
      const survey=await submitCsatByPortalToken({portalToken:req.query.token,input:req.body||{}});
      if(!survey)return res.status(404).json({success:false,message:'This ticket is not eligible for a satisfaction survey.'});
      return res.json({success:true,csat:{eligible:true,submitted:true,rating:survey.rating,comment:survey.comment||''}});
    }
    res.setHeader('Allow','GET, POST');return res.status(405).json({success:false,message:'Method not allowed'});
  }catch(error){return res.status(400).json({success:false,message:error.message||'Unable to update satisfaction survey.'});}
}
