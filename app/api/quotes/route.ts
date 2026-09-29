import {calculateQuote} from '@abc/core';
import {assertOwner,jsonError} from '../../../lib/auth';
export async function POST(req:Request){try{assertOwner(req);const body=await req.json();return Response.json(calculateQuote(body))}catch(e){return jsonError(e)}}
