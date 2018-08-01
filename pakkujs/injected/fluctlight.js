// (C) 2018 @xmcp. THIS PROJECT IS LICENSED UNDER GPL VERSION 3. SEE `LICENSE.txt`.

var DETAILS_MAX_TIMEDELTA=10;
var GRAPH_MAX_TIMEDELTA=5;
var GRAPH_DENSITY_POWER=.8;

function inject_fluctlight_graph(bar_elem,_version,new_elem) {
    var HEIGHT=600;
    var SEEKBAR_PADDING=_version==1 ? 6 : 0;
    var WIDTH=bar_elem.clientWidth-SEEKBAR_PADDING;
    
    var canvas_elem=document.createElement('canvas');
    var ctx=canvas_elem.getContext('2d');
    var details_elem=bar_elem.querySelector('.bilibili-player-video-progress-detail');
    if(!details_elem) {
        console.log('! fluctlight cannot find details_elem');
        return;
    }
    
    var DURATION=0;
    function getduration() {
        if(!DURATION) {
            var video_elem=root_elem.querySelector('video');
            var total_time_elem=root_elem.querySelector('.bilibili-player-video-time-total');
            DURATION=(
                (total_time_elem ? parse_time(total_time_elem.textContent) : 0) ||
                (video_elem ? video_elem.duration : 0)
            );
        }
    }
    getduration();

    function drawline(w,h,len,color,alpha) {
        ctx.fillStyle=color;
        ctx.globalAlpha=alpha;
        ctx.fillRect(w,HEIGHT-h,len,h);
    }
    
    var den_bef=[], den_aft=[];
    function block(time) {
        return Math.round(time*WIDTH/DURATION);
    }
    function recalc() {
        if(bar_elem.dataset['pakku_cache_width']==WIDTH) return true;
        bar_elem.dataset['pakku_cache_width']=WIDTH;
        console.log('pakku fluctlight: recalc dispval graph with WIDTH =',WIDTH);
        
        function dispval(str) {
            return Math.max(Math.sqrt(str.length),10);
        }
        function apply_dispval(arr) {
            return function(p) {
                var dispv=dispval(p.orig_str);
                arr[Math.max(0,block(p.time))]+=dispv;
                arr[block(p.time+GRAPH_MAX_TIMEDELTA)+1]-=dispv;
            }
        }
        
        den_bef=zero_array(WIDTH);
        den_aft=zero_array(WIDTH);

        getduration();
        if(!DURATION) {
            bar_elem.dataset['pakku_cache_width']=-1;
            console.log('pakku fluctlight: failed to get video duration');
            return;
        }

        D.forEach(function(d) {
            if(!d.peers.length || d.peers[0].mode=='8'/*code*/) return;
            apply_dispval(den_aft)(d.peers[0]);
            d.peers.forEach(apply_dispval(den_bef));
        });

        for(var w=1;w<WIDTH;w++) {
            den_bef[w]+=den_bef[w-1];
            den_aft[w]+=den_aft[w-1];
        }
        // make the peak 1px wider to increase visibility
        for(var w=WIDTH;w>0;w--)
            den_bef[w]=Math.max(den_bef[w],den_bef[w-1]);
        return true;
    }
    function redraw(hltime) {
        ctx.clearRect(0,0,WIDTH,HEIGHT);
        canvas_elem.width=WIDTH;
        if(!recalc()) return;
        
        ctx.beginPath();
        ctx.moveTo(0,HEIGHT);
        for(var w=0;w<WIDTH;w++)
        ctx.lineTo(w,HEIGHT-Math.pow(den_bef[w],GRAPH_DENSITY_POWER)/2);
        ctx.lineTo(WIDTH-1,HEIGHT);
        ctx.closePath();
        // before
        ctx.globalCompositeOperation='source-over';
        ctx.globalAlpha=.8;
        ctx.fillStyle='#ff4444';
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(0,HEIGHT);
        for(var w=0;w<WIDTH;w++)
            ctx.lineTo(w,HEIGHT-Math.pow(den_aft[w],GRAPH_DENSITY_POWER)/2);
        ctx.lineTo(WIDTH-1,HEIGHT);
        ctx.closePath();
        // clear
        ctx.globalCompositeOperation='destination-out';
        ctx.globalAlpha=1;
        ctx.fill();
        // after
        ctx.globalCompositeOperation='source-over';
        ctx.fillStyle='#7744ff';
        ctx.globalAlpha=.8;
        ctx.fill();

        var hlblock=(hltime===undefined)?undefined:block(hltime);
        if(hlblock!==undefined) {
            // add gradient
            var GRALENGTH=100;
            var gra=ctx.createLinearGradient(hlblock-GRALENGTH,0,hlblock+GRALENGTH,0);
            gra.addColorStop(0,'rgba(255,255,255,0)')
            gra.addColorStop(.1,'rgba(255,255,255,1)')
            gra.addColorStop(.9,'rgba(255,255,255,1)')
            gra.addColorStop(1,'rgba(255,255,255,0)')
            ctx.globalCompositeOperation='destination-out';
            ctx.globalAlpha=.4;
            ctx.fillStyle=gra;
            ctx.fillRect(hlblock-GRALENGTH,0,GRALENGTH*2,HEIGHT);
            // highlight current time
            ctx.globalCompositeOperation='source-over';
            drawline(hlblock,Math.pow(den_bef[hlblock],GRAPH_DENSITY_POWER)/2,2,'#cc0000',1);
            drawline(hlblock,Math.pow(den_aft[hlblock],GRAPH_DENSITY_POWER)/2,2,'#0000cc',1);
        }
    }
    redraw();
    window._pakku_fluctlight_highlight=redraw;
    
    canvas_elem.height=HEIGHT;
    canvas_elem.style.display='none';
    canvas_elem.style.pointerEvents='none';
    canvas_elem.style.zIndex=9999;

    
    if(_version==1) {
        canvas_elem.style.position='relative';
        canvas_elem.style.bottom=(HEIGHT+120)+'px';

        bar_elem.appendChild(canvas_elem);
    } else {
        canvas_elem.style.position='absolute';
        canvas_elem.style.bottom=(HEIGHT+114)+'px';
        canvas_elem.style.marginBottom=-HEIGHT+'px';

        new_elem.insertBefore(canvas_elem,new_elem.firstChild);
    }
    
    // show or hide
    new MutationObserver(function(muts) {
        var bar_opened=(details_elem.style.display!='none');
        if(bar_opened && canvas_elem.style.display=='none') {
            canvas_elem.style.display='initial';
            // detect resize
            var width=bar_elem.clientWidth-SEEKBAR_PADDING;
            if(width && width!==WIDTH) {
                WIDTH=width;
                redraw();
            }
        } else if(!bar_opened && canvas_elem.style.display!='none') {
            canvas_elem.style.display='none';
            canvas_elem.width=0;
        }
    }).observe(details_elem,{
        attributes: true,
        attributeFilter: ['style']
    });
}

function inject_fluctlight_details(bar_elem,_version) {
    var MAX_FLUCT=15;
    
    var fluct=document.createElement('div');
    var time_elem=bar_elem.querySelector('.bilibili-player-video-progress-detail-time');
    if(!time_elem) {
        console.log('! fluctlight cannot find time_elem');
        return;
    }
    
    function to_dom(danmu) {
        var p=make_p(proc_mode(danmu.peers[0].mode)+' '+danmu.text);
        if(danmu.peers.length>1)
            p.style.fontWeight='bold';
        return p;
    }
    function mode_prio(mode) { // smaller is more prior
        switch(parseInt(mode)) {
            case 4: return 1; //'↓↓'
            case 5: return 2; //'↑↑'
            case 7: return 3; //'**'
            case 1: return 4; //'|←'
            default: return 999;
        }
    }
    
    // time
    new MutationObserver(function(muts) {
        muts.forEach(function(mut) {
            if(mut.addedNodes) {
                var time_str=mut.addedNodes[0].textContent;
                if(time_str===fluct.dataset['current_time']) return;
                fluct.dataset['current_time']=time_str;
                
                fluct.style.height=0;
                fluct.textContent='';
                var time=parse_time(time_str);
                var danmus=[];
                for(var i=0;i<D.length;i++) {
                    var d=D[i];
                    if(d.peers.length && time-d.peers[0].time>=0 && time-d.peers[0].time<=DETAILS_MAX_TIMEDELTA && d.peers[0].mode!='8'/*code*/)
                        danmus.push(d);
                }
                danmus=danmus.sort(function(a,b) {
                    return (
                        a.peers.length - b.peers.length ||
                        mode_prio(b.peers[0].mode) - mode_prio(a.peers[0].mode) ||
                        (time-b) - (time-a) ||
                        0
                    );
                }).slice(-MAX_FLUCT);
                danmus.forEach(function(danmu) {
                    fluct.appendChild(to_dom(danmu));
                });
                fluct.style.height=(4+14*danmus.length)+'px';

                if(_version==1) {
                    fluct.style.bottom=(4+100+14*danmus.length)+'px';
                } else {
                    fluct.style.bottom=(4+72+14*danmus.length)+'px';
                }

                if(window._pakku_fluctlight_highlight)
                    window._pakku_fluctlight_highlight(time);
            }
        });
    }).observe(time_elem,{
        childList: true
    });
    
    // inject fluctlight
    fluct.setAttribute('style',`
        position: relative;
        width: 160px;
        overflow-x: hidden;
        text-align: left;
        font-size: 12px;
        line-height: 14px;
        padding: 2px;
        box-sizing: border-box;
        background-color: rgba(205,205,205,.8);
    `);

    fluct.dataset['current_time']='';
    time_elem.parentNode.appendChild(fluct);
}
