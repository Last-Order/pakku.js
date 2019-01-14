function id(x) {
    return document.getElementById(x);
}

function try_regexp(x) {
    try {
        return new RegExp(x);
    } catch(e) {
        alert('正则表达式语法有误：\n\n'+e.message)
        throw e;
    }
}

chrome.runtime.getBackgroundPage(function(bgpage) {
    id('clear').addEventListener('click',function() {
        localStorage['BLACKLIST']='[]';
        bgpage.loadconfig();
        location.reload();
    });
    id('load').addEventListener('click', function() {
        var currentBlacklist = JSON.parse(localStorage.getItem('BLACKLIST'));
        var result = '<filters>';
        for (var rule of currentBlacklist) {
            result += '\n    <item enabled="true">r=' + rule[0] + '</item>';
        }
        result += '\n</filters>';
        id('rules').value = result;
    })
    var BLACKLIST=bgpage.fromholyjson(localStorage['BLACKLIST']);
    id('count').textContent=BLACKLIST.length;
    id('import').addEventListener('click',function() {
        var rules=(new DOMParser).parseFromString(id('rules').value,'text/xml');
        var imported=BLACKLIST;
        [].slice.call(rules.querySelectorAll('filters>item[enabled="true"]')).forEach(function(rule_elem) {
            var rule=rule_elem.textContent;
            if(rule.indexOf('r=')==0 || rule.indexOf('t=')==0)
                imported.push([try_regexp(rule.substr(2)),'']);
            else {
                alert('无法识别的格式: '+rule);
                throw 1;
            }
        });
        localStorage['BLACKLIST']=bgpage.toholyjson(imported);
        bgpage.loadconfig();
        location.reload();
    });
});
