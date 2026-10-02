const form=document.querySelector('#waitlist');
form.addEventListener('submit',async(event)=>{
 event.preventDefault();
 const button=form.querySelector('button');
 const status=document.querySelector('#form-status');
 button.disabled=true; status.textContent='Saving your place…'; status.dataset.error='false';
 const values=new FormData(form);
 try{
  const response=await fetch('/api/waitlist',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:values.get('email'),company:values.get('company'),consent:values.has('consent')})});
  const result=await response.json();
  if(!response.ok) throw new Error(result.error || 'Please try again shortly.');
  status.textContent='You’re on the list. Thanks for your interest in Spammish.';form.reset();
 }catch(error){status.dataset.error='true';status.textContent=error instanceof TypeError?'Could not connect. Check your connection and try again.':error.message;}
 finally{button.disabled=false;}
});
