/*
 * To the extent possible under law, the author(s) have dedicated all copyright
 * and related and neighboring rights to this software to the public domain
 * worldwide. This software is distributed without any warranty.
 *
 * See <http://creativecommons.org/publicdomain/zero/1.0/> for a copy of the
 * CC0 Public Domain Dedication.
 */
var allProjects = ['commons', 'mediawiki', 'wikibooks', 'wikidata', 'wikimedia', 'wikinews', 'wikipedia', 'wikiquote', 'wikisource', 'wikivoyage'];
var run = 0;
var constraints = [];
var delay = 1000;
var job = false;
var i = 0;

String.prototype.capitalizeFirstLetter = function() {
    return this.charAt(0).toUpperCase() + this.slice(1);
};

function preg_quote( str ){
    return (str+'').replace(/([\\\.\+\*\?\[\^\]\$\(\)\{\}\=\!\<\>\|\:])/g, "\\$1");
}

function prefillForm() {
    var vars = {};
    var parts = window.location.href.replace(/[?&]+([^=&]+)=([^&]*)/gi, function(m, key, value) {
        if ($('input[name=' + key + ']') !== undefined) {
            $('input[name=' + key + ']').val(decodeURIComponent(value.replace(/\+/g, ' ')));
        }
    });
}

function toFile(format) {
    var del = (format == 'CSV') ? ';' : '\t';
    var fileData = ['article' + del + 'qid' + del + 'value' + del + 'result'];
    $('#result').find('div').each(function() {
        var tmpArr = [];
        tmpArr.push($(this).find('span').eq(0).find('a').text());
        if ($(this).find('span').eq(1).html() !== undefined) {
            var data = $(this).find('span').eq(1).html().split(' → ');
            tmpArr.push($(this).find('span').eq(1).find('a').eq(0).text());
            var val = data[2].match(/<i>(.*)<\/i>/);
            if (val !== null) {
                tmpArr.push(val[1]);
                tmpArr.push(data[2].replace('<i>', '').replace('</i>', ''));
            } else {
                tmpArr.push('');
                tmpArr.push(data[2]);
            }
        } else {
            tmpArr.push('');
            tmpArr.push('');
            tmpArr.push('');
        }
        fileData.push(tmpArr.join(del));
    });
    var output = fileData.join('\n');
    var uri = 'data:application/' + format + ';charset=UTF-8,' + encodeURIComponent(output);
    $(this)
        .attr({
            'download': 'harvesttemplates.' + format,
            'href': uri,
            'target': '_blank'
        });
}

function report(pageid, status, value, qid) {
    if (status == 'success' && job.datatype == 'wikibase-item') {
        value = '<a href="//www.wikidata.org/wiki/' + value + '" target="_blank">' + value + '</a>';
    }
    if (status == 'success') {
        $('#' + pageid).next().after('<span class="value"> → <a href="//www.wikidata.org/wiki/' + qid + '" target="_blank">' + qid + '</a> → added value <i>' + value + '</i></span>');
    } else {
        delay = 500;
        $('#' + pageid).next().after('<span class="value"> → <a href="//www.wikidata.org/wiki/' + qid + '" target="_blank">' + qid + '</a> → ' + value + '</span>');

    }
    $('#' + pageid).parent().addClass(status);
}

function reportStatus(status) {
    $('#status').html(status);
}

function stopJob() {
    run = 0;
    if ($('.stop').attr('id') == 'addvalues') {
        $('#addvalues').val('add values');
        $('#addvalues').removeClass('stop');
        $('#addvalues').addClass('run');
        $('#demo').attr('disabled', false);
    } else if ($('.stop').attr('id') == 'demo') {
        $('#demo').val('demo');
        $('#demo').removeClass('stop');
        $('#demo').addClass('run');
        $('#addvalues').attr('disabled', false);
        i = 0;
    }
    $('input[name="pagelist"]').attr('disabled', false);

}

function addMissingConstraintData( ii, callback ){
    if (ii == constraints.length){
        callback();
        return 1;
    }
    if (constraints[ii].type == 'Type' || constraints[ii].type == 'Value type'){
        var cl = 'wd:' + constraints[ii]['class'].join(' wd:');
        constraints[ii].values = [];
        $.getJSON('https://query.wikidata.org/bigdata/namespace/wdq/sparql?',{
                query: 'PREFIX wd: <http://www.wikidata.org/entity/> PREFIX wdt: <http://www.wikidata.org/prop/direct/> SELECT ?value WHERE {VALUES ?cl {' + cl + '} ?value wdt:P279* ?cl .}',
                format: 'json'
        }).done(function(data) {
            for (var row in data.results.bindings) {
                constraints[ii].values.push(parseInt(data.results.bindings[row].value.value.replace('http://www.wikidata.org/entity/Q', '')));
            }
            addMissingConstraintData( ii+1, callback );
        });
    }
    else if (constraints[ii].type == 'Unique value'){
        constraints[ii].values = [];
        $.getJSON('https://query.wikidata.org/bigdata/namespace/wdq/sparql?',{
            query: 'PREFIX wdt: <http://www.wikidata.org/prop/direct/>SELECT ?value WHERE {?item wdt:' + job.property + ' ?value .} GROUP BY ?value',
            format: 'json'
        }).done(function(data) {
            for (var row in data.results.bindings) {
                constraints[ii].values.push(data.results.bindings[row].value.value);
            }
            addMissingConstraintData( ii+1, callback );
        });
    }
    else {
        addMissingConstraintData( ii+1, callback );
    }
}


function createConstraints( callback ) {
    $.getJSON('getconstraints.php',{
        p: job.property
    }).done(function(data) {
        constraints = data;
        addMissingConstraintData( 0, callback);
    });
}


function getSiteid(siteid, project) {
    if (project == 'mediawiki' || project == 'wikidata') {
        return 'www';
    } else {
        return siteid.toLowerCase();
    }
}

function getLanguage(siteid, project) {
    if (project == 'mediawiki' || project == 'wikidata' || project == 'wikimedia') {
        return 'en';
    }
    langExceptions = {
        no: 'nb',
        simple: 'en',
        als: 'gsw'
    }
    if (siteid in langExceptions) {
        return langExceptions[siteid];
    }
    return siteid.toLowerCase();
}

function getDbname(siteid, project) {
    var qid = 0;
    if (project == 'wikipedia') {
        return siteid + 'wiki';
    } else if (siteid == 'commons' && project == 'wikimedia') {
        return 'commonswiki';
    } else if (siteid == 'species' && project == 'wikimedia') {
        return 'specieswiki';
    } else if (siteid == 'meta' && project == 'wikimedia') {
        return 'metawiki';
    } else if (siteid == 'www' && project == 'wikidata') {
        return 'wikidatawiki';
    } else if (siteid == 'www' && project == 'mediawiki') {
        return 'mediawikiwiki';
    } else {
        return siteid + project;
    }
}

function getWpEditionId(dbname) {
    $.ajax({
        type: 'GET',
        url: 'wpeditionids.json',
        dataType: 'json',
        async: false
    }).done(function(data) {
        qid = data[dbname];
    });
    return qid;
}

function setSource(qid, guid) {
    var sources = [{
        type: 'wikibase-entityid',
        q: qid,
        p: 'P143',
        numericid: job.wbeditionid
    }];
    $.ajax({
        type: 'GET',
        url: '../oauth.php',
        data: {
            action: 'addSource',
            guid: guid,
            sources: sources
        }
    });
}

function addValue(pageid, qid, value) {
    if (job.datatype == 'string' || job.datatype == 'external-id' || job.datatype == 'commonsMedia' || job.datatype == 'url') {
        claim = {
            type: 'string',
            q: qid,
            p: job.property,
            text: value
        };
    } else if (job.datatype == 'wikibase-item') {
        claim = {
            type: 'wikibase-entityid',
            q: qid,
            p: job.property,
            numericid: value.substring(1)
        };
    } else if (job.datatype == 'time') {
        var precision = 9;
        if (value.substring(5, 7) != '00') {
            precision = 10;
            if (value.substring(8, 10) != '00') {
                precision = 11;
            }
        }
        claim = {
            type: 'time',
            q: qid,
            p: job.property,
            date: '+' + value + 'T00:00:00Z',
            precision: precision,
            calendar: job.calendar
        }
    } else {
        reportStatus('not supported datatype: ' + job.datatype);
        return false;
    }
    if (job.demo == 1) {
        report(pageid, 'success', value, qid);
    } else {
        $.ajax({
            type: 'GET',
            url: '../oauth.php',
            data: {
                action: 'createClaim',
                claim: claim
            }
        })
        .done(function(data) {
            if (data.indexOf('createdClaim') > -1) {
                var res = data.split('|');
                var guid = res[1];
                setSource(qid, guid);
                report(pageid, 'success', value, qid);
            } else {
                report(pageid, 'error', data, qid);
            }
        });
    }
}


function checkConstraints(pageid, qid, value, ii) {
    if (ii == constraints.length){
        addValue(pageid, qid, value);
        return true;
    }
    var co = constraints[ii];
    if (co.type == 'Format') {
        var patt = new RegExp('^(' + co['pattern'] + ')$', co['modifier']);
        if (patt.test(value) == false) {
            report(pageid, 'error', 'Constraint violation: Format <i>' + value + '</i>', qid);
            return false;
        }
        checkConstraints(pageid, qid, value, ii+1);
        return true;
    }
    else if (co.type == 'Unique value') {
        if (co.values.indexOf(value) != -1) {
            report(pageid, 'error', 'Constraint violation: Unique value', qid);
            return false;
        }
        if (job.demo != 1) {
            constraints[ii]['values'].push(value);
        }
        checkConstraints(pageid, qid, value, ii+1);
        return true;
    }
    else if (co.type == 'Type') {
        var rel = co.relation == 'instance' ? 'P31' : 'P279';
        $.getJSON('https://www.wikidata.org/w/api.php?callback=?',{
            action: 'wbgetentities',
            ids: qid,
            format: 'json'
        }).done(function(data) {
            if (data.entities[qid].claims[rel] === undefined) {
                report(pageid, 'error', 'Constraint violation: Type', qid);
                return false;
            }
            for (var m in data.entities[qid].claims[rel]) {
                if (data.entities[qid].claims[rel][m].mainsnak.snaktype == 'value') {
                    var numericid = data.entities[qid].claims[rel][m].mainsnak.datavalue.value['numeric-id'];
                    if (co.values.indexOf(numericid) != -1) {
                        checkConstraints(pageid, qid, value, ii+1);
                        return true;
                    }
                }
            }
            report(pageid, 'error', 'Constraint violation: Type', qid);
            return false;
        });
    }
    else if (co.type == 'Value type'){
        var rel = co.relation == 'instance' ? 'P31' : 'P279';
        $.getJSON('https://www.wikidata.org/w/api.php?callback=?',{
            action: 'wbgetentities',
            ids: value,
            format: 'json'
        }).done(function(data) {
            if (data.entities[value].claims[rel] === undefined) {
                report(pageid, 'error', 'Constraint violation: Value type', qid);
                return false;
            }
            for (var m in data.entities[value].claims[rel]) {
                if (data.entities[value].claims[rel][m].mainsnak.snaktype == 'value') {
                    var numericid = data.entities[value].claims[rel][m].mainsnak.datavalue.value['numeric-id'];
                    if (co.values.indexOf(numericid) != -1) {
                        checkConstraints(pageid, qid, value, ii+1);
                        return true;
                    }
                }
            }
            report(pageid, 'error', 'Constraint violation: Value type', qid);
            return false;
        });
    }
    else if (co.type == 'One of'){
        if (co.values.indexOf(value) == -1) {
            report(pageid, 'error', 'Constraint violation: One of', qid);
            return false;
        }
        checkConstraints(pageid, qid, value, ii+1);
        return true;
    }
    else if (co.type == 'Commons link'){
        $.getJSON('https://commons.wikimedia.org/w/api.php?callback=?', {
            action: 'query',
            titles: co.namespace + ':' + value,
            format: 'json'
        }).done(function(data) {
            if ('-1' in data.query.pages) {
                report(pageid, 'error', 'Constraint violation: Commons link <i>' + value + '</i>', qid);
                return false;
            }
            checkConstraints(pageid, qid, value, ii+1);
            return true;
        });
    }
    else if (co.type == 'Conflicts with'){
        $.getJSON('https://www.wikidata.org/w/api.php?callback=?',{
            action: 'wbgetentities',
            ids: qid,
            format: 'json'
        }).done(function(data) {
            for (var pp in co.list){
                if (data.entities[qid].claims[pp] !== undefined) {
                    if (co.list[pp].length == 0){
                        report(pageid, 'error', 'Constraint violation: Conflics with', qid);
                        return false;
                    }
                    for (var m in data.entities[qid].claims[pp]) {
                        if (data.entities[qid].claims[pp][m].mainsnak.snaktype == 'value') {
                            var numericid = data.entities[qid].claims[pp][m].mainsnak.datavalue.value['numeric-id'];
                            if (co.list[pp].indexOf(numericid) != -1) {
                                report(pageid, 'error', 'Constraint violation: Conflics with', qid);
                                return false;
                            }
                        }
                    }
                }
            }
            checkConstraints(pageid, qid, value, ii+1);
            return true;
        });
    }
}

function parseDate(value) {
    var date = false;
    $.ajax({
        type: 'GET',
        url: 'monthnames.json',
        dataType: 'json',
        async: false
    }).done(function(monthnames) {
        value = value.replace(/–|-|—/g, '-');
        value = value.replace(/\[\[|\]\]/g, '');
        digits = {
            '०': 0,
            '१': 1,
            '२': 2,
            '३': 3,
            '४': 4,
            '५': 5,
            '६': 6,
            '७': 7,
            '८': 8,
            '९': 9
        }
        roman = {
            1: 'I',
            2: 'II',
            3: 'III',
            4: 'IV',
            5: 'V',
            6: 'VI',
            7: 'VII',
            8: 'VIII',
            9: 'IX',
            10: 'X',
            11: 'XI',
            12: 'XII'
        }
        $.each(digits, function(k, v) {
            r = new RegExp(k, 'g');
            value = value.replace(r, v)
        });
        //only year
        r = new RegExp('(\\d{4})');
        var res = value.match(r);
        if (res !== null) {
            date = res[1] + '-00-00';
        }
        $.each((monthnames[job.lang] || {}), function(name, num) {
            // month and year
            r = new RegExp('(' + name + '|' + name.substr(0, 3) + ') (\\d{4})', 'i');
            var res = value.match(r);
            if (res !== null) {
                date = res[2] + '-' + num + '-00';
            }
            // day, month, year
            r = new RegExp('(\\d{1,2})( |\\. |º |er | - an? de | de | d\')?(' + name + ')(,| del?|, इ.स.| พ.ศ.)? (\\d{4})', 'i');
            var res = value.match(r);
            if (res !== null) {
                date = res[5] + '-' + num + '-' + res[1];
            }
            // month, day, year
            r = new RegExp('(' + name + '|' + name.substr(0, 3) + ') (\\d{1,2})t?h?\\,? (\\d{4})', 'i');
            var res = value.match(r);
            if (res !== null) {
                date = res[3] + '-' + num + '-' + res[2];
            }
            // year, month, day
            r = new RegExp('(\\d{4})(e?ko|\\.|,)? (' + name + ')(aren)? (\\d{1,2})(a|ean|an)?', 'i');
            var res = value.match(r);
            if (res !== null) {
                date = res[1] + '-' + num + '-' + res[5];
            }
        });
        for (var num = 1; num <= 12; num++) {
            // day, month (number), year
            r = new RegExp('(\\d{1,2})([. /]+| tháng )(0?' + num + '|' + roman[num] + ')([., /]+| năm )(\\d{4})', 'i');
            var res = value.match(r);
            if (res !== null) {
                date = res[5] + '-' + num + '-' + res[1];
            }
            // year, month (number), day
            r = new RegExp('(\\d{4})( - |/)(0?' + num + '|' + roman[num] + ')( - |/)(\\d{1,2})', 'i');
            var res = value.match(r);
            if (res !== null) {
                date = res[1] + '-' + num + '-' + res[5];
            }
        }
        // Japanese/Chinese/Korean
        r = new RegExp('(\\d{4})(年|年\）|年[〈（\(][^）〉\)]+[〉|）|\)]|년)');
        var res = value.match(r);
        if (res !== null) {
            date = res[1] + '-00-00';
        }
        r = new RegExp('(\\d{4})(年|年\）|年[〈（\(][^）〉\)]+[〉|）|\)]|년 )(\\d{1,2})(月|월)');
        var res = value.match(r);
        if (res !== null) {
            date = res[1] + '-' + res[3] + '-00';
        }
        r = new RegExp('(\\d{4})(年|年\）|年[〈（\(][^）〉\)]+[〉|）|\)]|년 )(\\d{1,2})(月|월 )(\\d{1,2})(日|일)');
        var res = value.match(r);
        if (res !== null) {
            date = res[1] + '-' + res[3] + '-' + res[5];
        }
    });
    return date;
}

function handleValue(pageid, qid, value) {
    if (job.datatype == 'string' || job.datatype == 'external-id') {
        checkConstraints(pageid, qid, job.prefix + value, 0);
    } else if (job.datatype == 'url') {
        var res = value.match(/\[([^\s]+)(\s(.*))?\]/);
        if (res !== null) {
            value = res[1];
        }
        checkConstraints(pageid, qid, value, 0);
    } else if (job.datatype == 'wikibase-item') {
        var res = value.match(/^\[\[([^\|\]]+)/);
        if (res !== null) {
            res = res[1];
        } else {
            if (job.wikisyntax) {
                res = job.prefix + value;
            } else {
                report(pageid, 'error', 'no target page found', qid);
                return 0;
            }
        }
        if (res.indexOf('#') != -1) {
            report(pageid, 'error', 'no target page found', qid);
            return 0;
        }
        $.getJSON('https://' + job.siteid + '.' + job.project + '.org/w/api.php?callback=?', {
                action: 'query',
                prop: 'pageprops',
                titles: res,
                redirects: 1,
                format: 'json'
            })
            .done(function(data) {
                for (var m in data.query.pages) {
                    if (m != '-1') {
                        if ('pageprops' in data.query.pages[m]) {
                            if ('wikibase_item' in data.query.pages[m].pageprops) {
                                newvalue = data.query.pages[m].pageprops.wikibase_item;
                                checkConstraints(pageid, qid, newvalue, 0);
                            } else {
                                report(pageid, 'error', 'target has no Wikidata item', qid);
                            }
                        } else {
                            report(pageid, 'error', 'target has no Wikidata item', qid);
                        }
                    } else {
                        report(pageid, 'error', 'no target page found', qid);
                    }
                }
            });
    } else if (job.datatype == 'commonsMedia') {
        value = decodeURIComponent(value.replace(/_/g, ' '));
        checkConstraints(pageid, qid, value, 0);
    } else if (job.datatype == 'time') {
        if (typeof value === 'string') {
            var newvalue = parseDate(value);
        } else {
            if (value[1] === '' || value[1] == false){
                value[1] = '00';
            }
            if (value[2] === '' || value[2] == false){
                value[2] = '00';
            }
            var newvalue = value[0]+'-'+value[1]+'-'+value[2];
        }
        if (newvalue !== false) {
            newvalue = newvalue.replace(/-(\d)-/, '-0\$1-');
            newvalue = newvalue.replace(/-(\d)$/, '-0\$1');
            if (isNaN(parseInt(job.limityear))) {
                job.limityear = 1926;
            }
            if (job.rel == '=>') {
                if (parseInt(newvalue.substring(0, 4)) >= job.limityear) {
                    checkConstraints(pageid, qid, newvalue, 0);
                } else {
                    report(pageid, 'error', newvalue + ' < ' + job.limityear, qid);
                }
            } else {
                if (parseInt(newvalue.substring(0, 4)) <= job.limityear) {
                    checkConstraints(pageid, qid, newvalue, 0);
                } else {
                    report(pageid, 'error', newvalue + ' > ' + job.limityear, qid);
                }
            }
        } else {
            report(pageid, 'error', 'could not find a date', qid);
        }
    }
}

function parseTemplate(pageid, qid, text, parameter) {
    var result = '';
    text = text.replace(/(\r\n|\n|\r)/gm, '') //remove linebreaks
    text = text.replace(/<ref((?!<\/ref>).)*<\/ref>/g, ''); //remove references
    text = text.replace(/<ref([^>]+)>/g, ''); //remove reference tags
    text = text.replace(/\s\s+/g, ' '); //remove multiple spaces
    text = text.replace(new RegExp('{{\\s*' + job.templates, 'i'), '{{' + job.template);
    var txt = text.split('{{' + job.template);
    if (txt.length == 1) {
        report(pageid, 'error', 'Template not found', qid);
        return false;
    }
    text = txt[1];
    var patt = new RegExp('{{((?!}}|{{).)*}}');
    while (true) {
        if (patt.test(text)) {
            text = text.replace(patt, ''); //remove all other templates
        } else {
            break;
        }
    }
    txt = text.split('}}');
    text = txt[0];
    text = text.replace(/\|((?!\]\]|\||\[\[).)*\]\]/g, '\]\]'); //simplify links
    parts = text.split('|');
    var unnamed = [];
    $.each(parts, function(i, m) {
        if (m.indexOf('=') != '-1') {
            sp = m.split('=');
            if (sp[0].toLowerCase().trim() == parameter.toLowerCase()) {
                result = sp.slice(1).join('=').trim();
            }
        } else {
            unnamed.push(m.trim());
        }
    });
    if (result === '' && !isNaN(parameter)) {
        if (unnamed.length > parameter) {
            result = unnamed[parameter];
        }
    }
    if (result !== '') {
        if (job.demo != 1) {
            delay = 5000;
        }
        return result;
    } else {
        return false;
    }
}

function proceedOnePage() {
    if (run === 0) {
        reportStatus('stopped');
        return false;
    }
    if (i == $('input[name="pagelist"]').length) {
        reportStatus('done');
        stopJob();
        return true;
    }
    reportStatus('running (' + i + '/' + $('input[name="pagelist"]').length + ')');
    el = $('input[name="pagelist"]').eq(i);
    i += 1;
    if (el.prop('checked')) {
        setTimeout(function() {
            $.getJSON('https://' + job.siteid + '.' + job.project + '.org/w/api.php?callback=?', {
                    action: 'query',
                    prop: 'revisions',
                    pageids: el.attr('id'),
                    rvprop: 'content',
                    format: 'json'
                })
                .done(function(data2) {
                    if (job.parameter !== '') {
                        var value = parseTemplate(el.attr('id'), el.attr('data-qid'), data2.query.pages[el.attr('id')].revisions[0]['*'], job.parameter);
                        if (value !== false){
                            handleValue(el.attr('id'), el.attr('data-qid'), value);
                        } else {
                            report(el.attr('id'), 'error', 'no value', el.attr('data-qid'));
                        }
                    } else {
                        var value = [];
                        for (var kk = 1; kk <= 3; kk++) {
                            value.push(parseTemplate(el.attr('id'), el.attr('data-qid'), data2.query.pages[el.attr('id')].revisions[0]['*'], job['aparameter'+kk]));
                        }
                        if (value[0] !== false){
                            handleValue(el.attr('id'), el.attr('data-qid'), value);
                        } else {
                            report(el.attr('id'), 'error', 'no value', el.attr('data-qid'));
                        }
                    }
                    proceedOnePage();
                });
        }, delay);
    } else {
        proceedOnePage();
    }
}

function createCheckboxlist(pageids) {
    for (var j in pageids) {
        $('#result').append('<div><input type="checkbox" name="pagelist" id="' + pageids[j][0] + '" data-qid="' + pageids[j][1] + '" checked><span><a href="//' + job.siteid + '.' + job.project + '.org/wiki/' + pageids[j][2] + '" target="_blank">' + pageids[j][2].replace(/_/g, ' ') + '</a></span></div>');
    }
    $('#addvalues').show();
    $('#demo').show();
    $('.rightbox').show()
    reportStatus(pageids.length == 1 ? 'Found one page' : 'Found ' + pageids.length + ' pages');
}

function getPages() {
    job.template = job.template.capitalizeFirstLetter().replace(/_/g, ' ')
    $.getJSON('getcandidates.php?', {
            dbname: job.dbname,
            template: job.template,
            category: job.category,
            namespace: job.namespace,
            p: job.property
        })
        .done(function(pageids) {
            reportStatus('loading....');
            $.getJSON('https://' + job.siteid + '.' + job.project + '.org/w/api.php?callback=?', {
                    action: 'query',
                    prop: 'redirects',
                    titles: 'Template:' + job.template,
                    rdnamespace: 10,
                    format: 'json'
                })
                .done(function(data) {
                    job.templates = '(' + preg_quote(job.template) + '|' + preg_quote(job.template).replace(/ /g, '_');
                    for (var m in data.query.pages) {
                        if ('redirects' in data.query.pages[m]) {
                            for (var red in data.query.pages[m].redirects) {
                                var title = data.query.pages[m].redirects[red].title.split(':', 2);
                                job.templates += '|' + preg_quote(title[1]) + '|' + preg_quote(title[1]).replace(/ /g, '_');
                            }
                        }
                    }
                    job.templates += ')';
                    if (pageids.length > 0) {
                        createCheckboxlist(pageids);
                    } else {
                        reportStatus('nothing to do');
                    }
                });
        })
        .fail(function(jqxhr, textStatus, error) {
            var err = textStatus + ', ' + error;
            reportStatus('Request Failed: ' + err);
        });
}

function showAdditionalFields(){
    if ($('input[name="property"]').val() != ''){
        $.getJSON('https://www.wikidata.org/w/api.php?callback=?', {
            action: 'wbgetentities',
            ids: 'P' + $('input[name="property"]').val(),
            format: 'json'
        }, function(data) {
			var datatype = data.entities['P' + $('input[name="property"]').val()].datatype;
            if (datatype == 'wikibase-item') {
                $('#wikisyntax').show();
                $('#prefix').show();
            } else if (datatype == 'string' || datatype == 'external-id') {
                $('#prefix').show();
            } else if (datatype == 'time') {
                $('.timeparameters').show();
            }
        });
    }
}

function hideAdditionalFields(){
    $('#wikisyntax').hide();
    $('#prefix').hide();
    $('.timeparameters').hide();
}


$(document).ready(function() {

    prefillForm();
    showAdditionalFields();

    $('input').change(function() {
        $(this).removeClass('error');
    });
    $('input[name="property"]').change(function() {
        hideAdditionalFields();
        showAdditionalFields();
    });

    $('.permalink').click(function(e) {
        var url = '//tools.wmflabs.org/pltools/harvesttemplates/?';
        var params = $( 'form input:visible' ).serialize();
        window.open(url + params);
    });

    $('.download').click(function(e) {
        toFile.apply(this, [$(this).text()]);
    });

    $('input[type="submit"]').click(function(e) {
        e.preventDefault();
        if ($(this).attr('id') == 'getpages') {
            $.ajax({
                    type: 'GET',
                    url: '../oauth.php',
                    data: {
                        action: 'userinfo'
                    }
                })
                .done(function(data) {
                    if ('error' in data) {
                        reportStatus('You haven\'t authorized this application yet! Go <a href="../index.php?action=authorize" target="_parent">here</a> to do that.');
                    } else {
                        var error = 0;
                        $('#result').html('');
                        $('#addvalues').hide();
                        $('#demo').hide();
                        stopJob();
                        i = 0;

                        job = {}
                        var fields = $( 'form' ).serializeArray();
                        jQuery.each( fields, function( i, field ) {
                          job[field.name] = field.value;
                        });
                        job.property = 'P'+job.property

                        if (job.siteid === '') {
                            $('input[name="siteid"]').addClass('error');
                            error = 1;
                        }
                        if (job.project === '' || $.inArray(job.project, allProjects) == -1) {
                            $('input[name="project"]').addClass('error');
                            error = 1;
                        }
                        if (job.template === '') {
                            $('input[name="template"]').addClass('error');
                            error = 1;
                        }
                        if (job.parameter === '' && job.aparameter1 === '') {
                            $('input[name="parameter"]').addClass('error');
                            error = 1;
                        }
                        if (job.property == 'P') {
                            $('input[name="property"]').addClass('error');
                            error = 1;
                        }
                        if (job.namespace === '') {
                            $('input[name="namespace"]').addClass('error');
                            error = 1;
                        }
                        if (error === 0) {
                            job.siteid = getSiteid(job.siteid, job.project);
                            job.lang = getLanguage(job.siteid, job.project);
                            job.dbname = getDbname(job.siteid, job.project);
                            job.wbeditionid = getWpEditionId(job.dbname);
                            $.getJSON('https://www.wikidata.org/w/api.php?callback=?', {
                                action: 'wbgetentities',
                                ids: job.property,
                                format: 'json'
                            }, function(data) {
                                job.datatype = data.entities[job.property].datatype;
                                // TODO: monolingualtext, quantity, geocoordinate, math
                                if (job.datatype == 'string' || job.datatype == 'external-id' || job.datatype == 'wikibase-item' || job.datatype == 'commonsMedia' || job.datatype == 'url' || job.datatype == 'time') {
                                    reportStatus('loading..');
                                    createConstraints( function() {
                                        reportStatus('loading...');
                                        getPages();
                                    });
                                } else {
                                    reportStatus('datatype ' + job.datatype + ' is not yet supported');
                                }
                            });
                        }
                    }
                });
        } else if ($(this).val() == 'demo' || $(this).val() == 'add values') {
            if (job.demo == 1) {
                $("#result").find('div').each(function(index, value) {
                    $(this).removeClass();
                    $(this).find('.value').html('');
                });
            }
            if ($(this).val() == 'demo') {
                job.demo = 1;
                $('#addvalues').attr('disabled', true);
            } else {
                job.demo = 0;
                $('#demo').attr('disabled', true);
            }
            run = 1;
            $('input[name="pagelist"]').attr('disabled', true);
            $(this).val('stop');
            $(this).removeClass('run');
            $(this).addClass('stop');
            proceedOnePage();
        } else {
            stopJob();
        }
    });
});
