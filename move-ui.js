/* Shared move-card renderer used by VS AI and online PvP. */
(function(root){
 'use strict';
 function esc(value){return String(value==null?'':value).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
 function render(rootEl,moves,selected,options){
  if(!rootEl)return;
  options=options||{};
  var selectedSet=new Set((selected||[]).map(String));
  var key=options.keyAttribute||'data-move-key';
  rootEl.innerHTML=(moves||[]).map(function(m){
   var id=String(options.getId?options.getId(m):(m.id==null?m.name:m.id));
   var on=selectedSet.has(id),reason=options.getDisabledReason?options.getDisabledReason(m):'';
   var disabled=!!reason||!!options.disabled;
   var cls='move-choice'+(on?' selected':'')+(disabled?' blocked':'');
   var mark=reason?(options.disabledMark||'봉쇄'):(on?'✓':'');
   var detail=options.getDetail?options.getDetail(m,reason):'기본 피해 '+Number(m.damage||0)+' · '+(options.costText?options.costText(m.cost):'');
   if(reason&&options.reasonInDetail!==false&&detail.indexOf(reason)<0)detail+=(detail?' · ':'')+reason;
   return '<button type="button" class="'+cls+'" data-move-id="'+esc(id)+'" '+key+'="'+esc(id)+'" aria-pressed="'+on+'" '+(disabled?'disabled':'')+'><span class="pick-mark">'+esc(mark)+'</span><b>'+esc(m.name)+'</b><small>'+esc(detail)+'</small></button>';
  }).join('');
 }
 root.PlakoroMoveUI={renderCards:render};
})(window);
