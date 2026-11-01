const bytes = n => n == null ? '暂不可用' : n >= 1024**3 ? (n/1024**3).toFixed(2)+' GB' : (n/1024**2).toFixed(1)+' MB';

export async function mountMaintenance(ctx){
  const panel=document.querySelector('#maintenance-panel');
  if(!panel)return;
  const {api,e}=ctx;
  try{
    const data=await api('/maintenance');
    if(!panel.isConnected)return;
    const last=data.config.last_result;
    panel.innerHTML=`<h2>存储与清理</h2><p>主服务当前内存：<b>${e(bytes(data.memory_bytes))}</b></p><p class="hint">${e(data.memory_scope)}。关闭网页标签不会停止后台；不用时双击“停止欢欢工作台.bat”释放后台内存。转写和抽帧结束后，相关子进程会退出。</p><dl class="definition">${[['视频与关键帧','videos_and_frames'],['本地语音模型','models'],['宣传项目资料','promo'],['数据库、日志等','other_data']].map(([label,key])=>`<dt>${label}</dt><dd>${e(bytes(data.storage[key]))}</dd>`).join('')}</dl><p class="hint">以上是 data 文件夹的磁盘占用，与运行内存不同。模型留着可避免下次重新下载。</p><div class="note-box">可清理：${data.cleanup_count} 个文件，约 ${e(bytes(data.cleanup_bytes))}。<br>只选七天前的下载临时文件、三十天前的归档日志。原视频、关键帧、转写、脚本、模型、密钥和 Cookie 均保留。</div>${data.preview.length?`<details style="margin-top:12px"><summary>查看待清理文件（最多50项）</summary>${data.preview.map(x=>`<p class="hint" style="overflow-wrap:anywhere">${e(x.file)} · ${e(bytes(x.bytes))}</p>`).join('')}</details>`:''}<label class="hint" style="display:block;margin-top:16px"><input id="maintenance-auto" type="checkbox" ${data.config.auto_cleanup?'checked':''}> 开启每日临时文件清理</label><p class="hint">仅在工作台后台运行时执行，每天最多一次，半小时检查一次；视频处理中会跳过。关闭电脑不会执行，也无需为清理一直开着。</p><div class="row wrap"><button class="button" data-action="maintenance-save">保存清理设置</button><button class="button" data-action="maintenance-cleanup" ${data.active_jobs?'disabled':''}>清理过期临时文件</button><button class="text-link" data-action="maintenance-refresh">刷新占用</button></div>${last?`<p class="hint">上次清理：${e(last.time)} · ${last.files} 个文件 · ${e(bytes(last.bytes))}</p>`:''}`;
  }catch(error){
    if(panel.isConnected)panel.innerHTML=`<h2>存储与清理</h2><p class="hint">${e(error.message)}。如果刚更新代码，请停止并重新启动工作台。</p>`;
  }
}

export async function maintenanceAction(name,ctx){
  if(name==='maintenance-refresh')return mountMaintenance(ctx);
  if(name==='maintenance-save'){
    await ctx.api('/maintenance/settings',{method:'PUT',body:{auto_cleanup:!!document.querySelector('#maintenance-auto')?.checked}});
    ctx.toast('清理设置已保存');
  }else if(name==='maintenance-cleanup'){
    const preview=await ctx.api('/maintenance');
    if(preview.active_jobs){ctx.toast('视频处理中，请稍后清理');return;}
    if(!preview.cleanup_count){ctx.toast('目前没有过期临时文件需要清理');return;}
    if(!confirm(`清理 ${preview.cleanup_count} 个过期临时文件，约 ${bytes(preview.cleanup_bytes)}？视频、关键帧和脚本会保留。`))return;
    const result=await ctx.api('/maintenance/cleanup',{method:'POST'});
    ctx.toast(result.skipped?result.reason:`已清理 ${result.files} 个文件，释放 ${bytes(result.bytes)}`);
  }
  return mountMaintenance(ctx);
}
