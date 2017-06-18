/*
 * To the extent possible under law, the author(s) have dedicated all copyright
 * and related and neighboring rights to this software to the public domain
 * worldwide. This software is distributed without any warranty.
 *
 * See <http://creativecommons.org/publicdomain/zero/1.0/> for a copy of the
 * CC0 Public Domain Dedication.
 */
var allProjects = ['commons', 'mediawiki', 'wikibooks', 'wikidata', 'wikimedia', 'wikinews', 'wikipedia', 'wikiquote', 'wikisource', 'wikiversity', 'wikivoyage'];
var namespaces, fileprefixes, templateprefixes;
var run = 0;
var constraints = [];
var delay = 500;
var job = false;
var i = 0;
var bot = 0;
var cntSuccess = 0;
var cntError = 0;
var autoload = false;
var autorun = false;
var tempunit = false;

String.prototype.capitalizeFirstLetter = function() {
    return this.charAt(0).toUpperCase() + this.slice(1);
};

function preg_quote( str ){
    return (str+'').replace(/([\\\.\+\*\?\[\^\]\$\(\)\{\}\=\!\<\>\|\:])/g, "\\$1");
}

function escapeHTML( str ) {
    return (str+'')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\"/g, '&quot;')
        .replace(/\'/g, '&#39;');
}

function toArabicNumerals(str) {
    $.each(numerals, function(k, v) {
        var r = new RegExp(k, 'g');
        str = str.replace(r, v);
    });
    return str;
}

function prefillForm() {
    window.location.href.replace(/[?&]+([^=&]+)=([^&]*)/g, function(m, key, value) {
        if (key == 'run' || key == 'load') {
            autoload = true;
            autorun = autorun || (key == 'run');
            return;
        }
        if (value !== '') {
            var $input = $('input[name=' + key + ']');
            if ($input.length > 0) {
                if (key == 'parameter' && $input.last().val() !== ''){
                    addAlias();
                    $input = $($input.selector); // reload as we have one more field
                }
                if ($input.attr('type') == 'checkbox') {
                    if (value == '1' || value == key){
                        $input.prop('checked', true);
                    } else {
                        $input.prop('checked', false);
                    }
                } else {
                    $input.last().val(decodeURIComponent(value.replace(/\+/g, ' ')));
                }
                return;
            }
            var $select = $('select[name=' + key + '] option');
            if ($select.length > 0){
                $select.each(function() { this.selected = (this.value == value); });
            } else if (key == 'unit'){
                tempunit = value;
            }
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
                tmpArr.push(val[1].replace(/<\/?[ai][^>]*>/g, ''));
                tmpArr.push(data[2].replace(/<\/?[ai][^>]*>/g, ''));
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
            'download': 'harvesttemplates_' + job.property + '_' + job.dbname + '.' + format,
            'href': uri,
            'target': '_blank'
        });
}

function report(pageid, status, value, qid) {
    if (status == 'success') {
        cntSuccess += 1;
        if (job.datatype == 'wikibase-item') {
            value = '<a href="//www.wikidata.org/wiki/' + value + '" target="_blank">' + value + '</a>';
        } else {
            value = escapeHTML(value);
        }
        $('#' + pageid).next().after('<span class="value"> → <a href="//www.wikidata.org/wiki/' + qid + '" target="_blank">' + qid + '</a> → added value <i>' + value + '</i></span>');
    } else {
        delay = 500;
        cntError += 1;
        $('#' + pageid).next().after('<span class="value"> → <a href="//www.wikidata.org/wiki/' + qid + '" target="_blank">' + qid + '</a> → ' + value + '</span>');
    }
    $('#' + pageid).parent().addClass(status);
}

function reportStatus(status) {
    $('#status').html(status);
}

function stopLoading(status) {
    reportStatus(status);
    $('#getpages').attr('disabled', false);
}

function stopJob() {
    run = 0;
    autorun = false;
    if ($('.stop').attr('id') == 'addvalues') {
        $('#addvalues')
            .val('add values')
            .removeClass('stop')
            .addClass('run');
        $('#demo').attr('disabled', false);
    } else if ($('.stop').attr('id') == 'demo') {
        $('#demo')
            .val('demo')
            .removeClass('stop')
            .addClass('run');
        $('#addvalues').attr('disabled', false);
        i = 0;
    }
    $('#getpages').attr('disabled', false);
    $('input[name="pagelist"]').attr('disabled', false);
}

function addMissingConstraintData( ii ){
    if (ii == constraints.length) {
        reportStatus('loading...');
        getPages();
        return 1;
    }
    if (constraints[ii].type == 'Qualifier' || constraints[ii].type == 'Source') {
        stopLoading('Constraint violation: ' + constraints[ii].type);
        $('input[name="property"]').addClass('error');
    } else if (constraints[ii].type == 'Qualifiers') {
        if (constraints[ii].required === 'true' && !!constraints[ii].list) {
            stopLoading('Constraint violation: Mandatory qualifiers');
            $('input[name="property"]').addClass('error');
        }
    } else if (constraints[ii].type == 'Type' || constraints[ii].type == 'Value type'){
        var cl = 'wd:' + constraints[ii].class.join(' wd:');
        constraints[ii].values = [];
        $.getJSON('https://query.wikidata.org/bigdata/namespace/wdq/sparql?',{
            query: 'SELECT ?value WHERE { VALUES ?cl { ' + cl + ' } . ?value wdt:P279* ?cl }',
            format: 'json'
        }).done(function(data) {
            for (var row in data.results.bindings) {
                constraints[ii].values.push(parseInt(data.results.bindings[row].value.value.replace('http://www.wikidata.org/entity/Q', '')));
            }
            addMissingConstraintData( ++ii );
        }).fail(function(data) {
            stopLoading('WQS query expired');
        });
    } else if (constraints[ii].type == 'Unique value') {
        constraints[ii].values = [];
        $.getJSON('https://query.wikidata.org/bigdata/namespace/wdq/sparql?',{
            query: 'SELECT ?value WHERE { ?item wdt:' + job.property + ' ?value } GROUP BY ?value',
            format: 'json'
        }).done(function(data) {
            for (var row in data.results.bindings) {
                var value = data.results.bindings[row].value.value;
                if (value.indexOf('http://commons.wikimedia.org/wiki/Special:FilePath/') === 0) {
                    value = value.replace('http://commons.wikimedia.org/wiki/Special:FilePath/', '');
                    value = decodeURIComponent(value);
                }
                constraints[ii].values.push(value);
            }
            addMissingConstraintData( ++ii );
        }).fail(function(data) {
            stopLoading('WQS query expired');
        });
    } else if (constraints[ii].type == 'Commons link') {
        constraints[ii].namespace = constraints[ii].namespace.capitalizeFirstLetter();
        $.getJSON('https://commons.wikimedia.org/w/api.php?callback=?', {
            action: 'query',
            meta: 'siteinfo',
            siprop: 'namespaces',
            format: 'json'
        }).done(function(data) {
            for (var ns in data.query.namespaces) {
                if (
                    data.query.namespaces[ns]['*'] === constraints[ii].namespace ||
                    (data.query.namespaces[ns].canonical !== undefined && data.query.namespaces[ns].canonical === constraints[ii].namespace)
                ) {
                    constraints[ii].namespaceid = data.query.namespaces[ns].id;
                    break;
                }
            }
            if (constraints[ii].namespaceid === undefined) {
                stopLoading('Undefined namespace "' + constraints[ii].namespace + '"');
                return;
            }
            addMissingConstraintData( ++ii );
        });
    } else {
        addMissingConstraintData( ++ii );
    }
}


function createConstraints() {
    $.getJSON('getconstraints.php', {
        p: job.property
    }).done(function(data) {
        constraints = data;
        addMissingConstraintData( 0 );
    });
}

function loadSiteinfo() {
    $.getJSON('https://' + job.siteid + '.' + job.project + '.org/w/api.php?callback=?', {
        action: 'query',
        meta: 'siteinfo',
        siprop: 'general|namespaces|namespacealiases',
        format: 'json'
    }).done(function(data) {
        job.lang = data.query.general.lang;
        job.dbname = data.query.general.wikiid;
        if ( !wbeditionid[job.dbname] ) {
            $('input[name="siteid"], input[name="project"]').addClass('error');
            stopLoading(job.siteid + '.' + job.project + '.org (' + job.dbname + ') doesn\'t have an item yet.<br>' +
                'Please create it if it doesn\'t exist yet and ask for adding it.');
            return;
        }
        namespaces = {};
        for (var ns in data.query.namespaces) {
            namespaces[ns] = data.query.namespaces[ns]['*'];
        }
        fileprefixes = ['File', namespaces[6]];
        templateprefixes = ['Template', namespaces[10]];
        for (var i in data.query.namespacealiases) {
            if (data.query.namespacealiases[i].id == 6) {
                fileprefixes.push(data.query.namespacealiases[i]['*']);
            } else if (data.query.namespacealiases[i].id == 10) {
                templateprefixes.push(data.query.namespacealiases[i]['*']);
            }
        }
        createConstraints();
    });
}

function getSiteid(siteid, project) {
    if (project == 'mediawiki' || project == 'wikidata') {
        return 'www';
    } else {
        return siteid.toLowerCase();
    }
}

function setSource(qid, guid) {
    var sources = [{
        type: 'wikibase-entityid',
        q: qid,
        p: 'P143',
        numericid: wbeditionid[job.dbname]
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
    var claim;
    switch (job.datatype) {
        case 'commonsMedia':
        case 'external-id':
        case 'string':
        case 'url':
            claim = {
                type: 'string',
                q: qid,
                p: job.property,
                text: value
            };
            break;
        case 'wikibase-item':
            claim = {
                type: 'wikibase-entityid',
                q: qid,
                p: job.property,
                numericid: value.substring(1)
            };
            break;
        case 'time':
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
                calendar: 'http://www.wikidata.org/entity/' + job.calendar
            };
            break;
        case 'quantity':
            claim = {
                type: 'quantity',
                q: qid,
                p: job.property,
                amount: value,
                unit: 'http://www.wikidata.org/entity/' + job.unit
            };
            break;
    }
    if (!claim) {
        stopLoading('not supported datatype: ' + job.datatype);
        $('input[name="property"]').addClass('error');
        stopJob();
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
                report(pageid, 'error', escapeHTML(data), qid);
            }
        });
    }
}


function checkConstraints(pageid, qid, value, ii) {
    if (ii == constraints.length) {
        if (job.demo != 1) {
            for (var i = 0; i < ii; i++) {
                if (constraints[i].type == 'Unique value') {
                    constraints[i].values.push(value);
                    break;
                }
            }
        }
        addValue(pageid, qid, value);
        return true;
    }
    var co = constraints[ii];
    if (co.type == 'Format') {
        var patt = new RegExp('^(' + co.pattern + ')$', co.modifier);
        if (patt.test(value) === false) {
            report(pageid, 'error', 'Constraint violation: Format <i>' + escapeHTML(value) + '</i>', qid);
            return false;
        }
        checkConstraints(pageid, qid, value, ++ii);
        return true;
    }
    else if (co.type == 'Unique value') {
        if (co.values.indexOf(value) != -1) {
            report(pageid, 'error', 'Constraint violation: Unique value <i>' + escapeHTML(value) + '</i>', qid);
            return false;
        }
        checkConstraints(pageid, qid, value, ++ii);
        return true;
    }
    else if (co.type == 'Type') {
        var rel = co.relation == 'instance' ? 'P31' : 'P279';
        $.getJSON('https://www.wikidata.org/w/api.php?callback=?',{
            action: 'wbgetentities',
            ids: qid,
            props: 'claims',
            format: 'json'
        }).done(function(data) {
            if (data.entities[qid].claims[rel] === undefined) {
                report(pageid, 'error', 'Constraint violation: Type <i>undefined</i>', qid);
                return false;
            }
            for (var m in data.entities[qid].claims[rel]) {
                if (data.entities[qid].claims[rel][m].mainsnak.snaktype == 'value') {
                    var numericid = data.entities[qid].claims[rel][m].mainsnak.datavalue.value['numeric-id'];
                    if (co.values.indexOf(numericid) != -1) {
                        checkConstraints(pageid, qid, value, ++ii);
                        return true;
                    }
                }
            }
            report(pageid, 'error', 'Constraint violation: Type <i>Q' + data.entities[qid].claims[rel][0].mainsnak.datavalue.value['numeric-id'] + '</i>', qid);
            return false;
        });
    }
    else if (co.type == 'Value type'){
        var rel = co.relation == 'instance' ? 'P31' : 'P279';
        $.getJSON('https://www.wikidata.org/w/api.php?callback=?',{
            action: 'wbgetentities',
            ids: value,
            props: 'claims',
            format: 'json'
        }).done(function(data) {
            if (data.entities[value].claims[rel] === undefined) {
                report(pageid, 'error', 'Constraint violation: Value type <i>undefined</i>', qid);
                return false;
            }
            for (var m in data.entities[value].claims[rel]) {
                if (data.entities[value].claims[rel][m].mainsnak.snaktype == 'value') {
                    var numericid = data.entities[value].claims[rel][m].mainsnak.datavalue.value['numeric-id'];
                    if (co.values.indexOf(numericid) != -1) {
                        checkConstraints(pageid, qid, value, ++ii);
                        return true;
                    }
                }
            }
            report(pageid, 'error', 'Constraint violation: Value type <i>Q' + data.entities[value].claims[rel][0].mainsnak.datavalue.value['numeric-id'] + '</i>', qid);
            return false;
        });
    }
    else if (co.type == 'One of'){
        if (co.values.indexOf(value) == -1) {
            report(pageid, 'error', 'Constraint violation: One of <i>' + escapeHTML(value) + '</i>', qid);
            return false;
        }
        checkConstraints(pageid, qid, value, ++ii);
        return true;
    }
    else if (co.type == 'Commons link'){
        $.getJSON('https://commons.wikimedia.org/w/api.php?callback=?', {
            action: 'query',
            titles: co.namespace + ':' + value,
            redirects: 'true',
            format: 'json'
        }).done(function(data) {
            if ('-1' in data.query.pages) {
                report(pageid, 'error', 'Constraint violation: Commons link <i>' + co.namespace + ':' + escapeHTML(value) + '</i>', qid);
                return false;
            }
            for (var m in data.query.pages){
                if (data.query.pages[m].ns !== co.namespaceid) {
                    report(pageid, 'error', 'Constraint violation: Commons link <i>' + co.namespace + ':' + escapeHTML(value) + '</i>', qid);
                    return false;
                } else {
                    value = data.query.pages[m].title.slice(co.namespace.length+1)
                }
            }
            checkConstraints(pageid, qid, value, ++ii);
            return true;
        });
    }
    else if (co.type == 'Conflicts with'){
        $.getJSON('https://www.wikidata.org/w/api.php?callback=?',{
            action: 'wbgetentities',
            ids: qid,
            props: 'claims',
            format: 'json'
        }).done(function(data) {
            for (var pp in co.list){
                if (data.entities[qid].claims[pp] !== undefined) {
                    if (co.list[pp].length === 0){
                        report(pageid, 'error', 'Constraint violation: Conflicts with', qid);
                        return false;
                    }
                    if (pp == job.property) {
                        if ($.inArray(value, co.list[pp]) !== -1) {
                            report(pageid, 'error', 'Constraint violation: Conflicts with', qid);
                            return false;
                        }
                        continue;
                    }
                    for (var m in data.entities[qid].claims[pp]) {
                        if (data.entities[qid].claims[pp][m].mainsnak.snaktype == 'value') {
                            var numericid = data.entities[qid].claims[pp][m].mainsnak.datavalue.value['numeric-id'];
                            if (co.list[pp].indexOf(numericid) != -1) {
                                report(pageid, 'error', 'Constraint violation: Conflicts with', qid);
                                return false;
                            }
                        }
                    }
                }
            }
            checkConstraints(pageid, qid, value, ++ii);
            return true;
        });
    }
    else if (co.type == 'Range') {
        if (value < parseFloat(co.min) || value > parseFloat(co.max)) {
            report(pageid, 'error', 'Constraint violation: Range <i>' + escapeHTML(value) + '</i>', qid);
            return false;
        }
        checkConstraints(pageid, qid, value, ++ii);
        return true;
    }
}

function parseDate(value) {
    var date = false;
    value = value
        .replace(/–|-|—/g, '-')
        .replace(/\[\[|\]\]/g, '');
    value = toArabicNumerals(value);
    var roman = {
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
    };
    //imprecise dates
    var r = new RegExp('\\b(años|vor|nach|ungefähr|ca\.?|around)\\b');
    var res = value.match(r);
    if (res !== null) {
        return date;
    }
    //only year
    r = new RegExp('\\b(\\d{4})\\b');
    res = value.match(r);
    if (res !== null) {
        date = res[1] + '-00-00';
    }
    $.each((monthnames[job.lang] || {}), function(name, num) {
        // month and year
        r = new RegExp('(' + name + '|' + name.substr(0, 3) + ') (\\d{4})', 'i');
        res = value.match(r);
        if (res !== null) {
            date = res[2] + '-' + num + '-00';
        }
        // day, month, year
        r = new RegExp('(\\d{1,2})( |\\. |º |er | - an? de | de | d\')?(' + name + ')(,| del?|, इ.स.| พ.ศ.)? (\\d{4})', 'i');
        res = value.match(r);
        if (res !== null) {
            date = res[5] + '-' + num + '-' + res[1];
        }
        // month, day, year
        r = new RegExp('(' + name + '|' + name.substr(0, 3) + ') (\\d{1,2})t?h?\\,? (\\d{4})', 'i');
        res = value.match(r);
        if (res !== null) {
            date = res[3] + '-' + num + '-' + res[2];
        }
        // year, month, day
        r = new RegExp('(\\d{4})(e?ko|\\.|,)? (' + name + ')(aren)? (\\d{1,2})(a|ean|an)?', 'i');
        res = value.match(r);
        if (res !== null) {
            date = res[1] + '-' + num + '-' + res[5];
        }
    });
    for (var num = 1; num <= 12; num++) {
        // day, month (number), year
        r = new RegExp('(\\d{1,2})([. /]+| tháng )(0?' + num + '|' + roman[num] + ')([., /]+| năm )(\\d{4})', 'i');
        res = value.match(r);
        if (res !== null) {
            date = res[5] + '-' + num + '-' + res[1];
        }
        // year, month (number), day
        r = new RegExp('(\\d{4})( - |/)(0?' + num + '|' + roman[num] + ')( - |/)(\\d{1,2})', 'i');
        res = value.match(r);
        if (res !== null) {
            date = res[1] + '-' + num + '-' + res[5];
        }
    }
    // Japanese/Chinese/Korean
    r = new RegExp('(\\d{4})(年|年\）|年[〈（\(][^）〉\)]+[〉|）|\)]|년)');
    res = value.match(r);
    if (res !== null) {
        date = res[1] + '-00-00';
    }
    r = new RegExp('(\\d{4})(年|年\）|年[〈（\(][^）〉\)]+[〉|）|\)]|년 )(\\d{1,2})(月|월)');
    res = value.match(r);
    if (res !== null) {
        date = res[1] + '-' + res[3] + '-00';
    }
    r = new RegExp('(\\d{4})(年|年\）|年[〈（\(][^）〉\)]+[〉|）|\)]|년 )(\\d{1,2})(月|월 )(\\d{1,2})(日|일)');
    res = value.match(r);
    if (res !== null) {
        date = res[1] + '-' + res[3] + '-' + res[5];
    }
    return date;
}

function checkForInterwiki(pageid, qid, res, url) {
    $.getJSON(url + '/w/api.php?callback=?', {
        action: 'query',
        prop: 'pageprops',
        ppprop: 'wikibase_item',
        titles: res,
        redirects: 1,
        format: 'json'
    })
    .done(function(data) {
        if ('interwiki' in data.query) {
            $.getJSON(url + '/w/api.php?callback=?', {
                action: 'query',
                meta: 'siteinfo',
                siprop: 'interwikimap',
                sifilteriw: 'local',
                format: 'json'
            })
            .done(function(data2) {
                var interwikimap = data2.query.interwikimap,
                    iw = data.query.interwiki[0].iw;
                for (var i in interwikimap) {
                    if (interwikimap[i].prefix == iw) {
                        checkForInterwiki(pageid, qid, res.slice(iw.length + 1), interwikimap[i].url.replace('/wiki/$1', ''));
                        return;
                    }
                }
                report(pageid, 'error', 'no target page found', qid);
            });
        } else {
            for (var m in data.query.pages) {
                if (m != '-1') {
                    if ('pageprops' in data.query.pages[m]) {
                        var newvalue = data.query.pages[m].pageprops.wikibase_item;
                        if (newvalue == qid) {
                            report(pageid, 'error', 'target is same as the item', qid);
                        } else {
                            checkConstraints(pageid, qid, newvalue, 0);
                        }
                    } else {
                        report(pageid, 'error', 'target has no Wikidata item', qid);
                    }
                } else {
                    report(pageid, 'error', 'no target page found', qid);
                }
            }
        }
    });
}

function handleValue(pageid, qid, value) {
    if (job.datatype == 'string' || job.datatype == 'external-id') {
        checkConstraints(pageid, qid, job.prefix + value, 0);
    } else if (job.datatype == 'url') {
        var res = value.match(/\[([^\s\]]+)(\s(.*))?\]/);
        if (res !== null) {
            value = res[1];
        }
        checkConstraints(pageid, qid, job.prefix + value, 0);
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
        checkForInterwiki(pageid, qid, res, 'https://' + job.siteid + '.' + job.project + '.org');
    } else if (job.datatype == 'commonsMedia') {
        var res = value.match(/\[\[([^\|\]]+)/);
        if (res !== null) {
            value = res[1];
        }
        value = value.replace(new RegExp('^(' + fileprefixes.join('|') + '):\\s*', 'i'), '');
        value = decodeURIComponent(value).replace(/_/g, ' ');
        checkConstraints(pageid, qid, value, 0);
    } else if (job.datatype == 'time') {
        if (typeof value !== 'string') {
            if (value[1] === undefined) {
                value[1] = '00';
            }
            if (value[2] === undefined) {
                value[2] = '00';
            }
            value = value[2] + ' ' + value[1] + ' ' + value[0];
        }

        var newvalue = parseDate(value);
        if (newvalue !== false) {
            newvalue = newvalue.replace(/-(\d)-/, '-0\$1-');
            newvalue = newvalue.replace(/-(\d)$/, '-0\$1');
            if (newvalue.substring(5, 10) == '00-00') {
                checkConstraints(pageid, qid, newvalue, 0);
            } else if (job.rel == 'geq') {
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
    } else if (job.datatype == 'quantity'){
        value = value.replace(/(\d)(&nbsp;|\s|')(\d)/g, '$1$3'); //remove thousands separator
        value = toArabicNumerals(value);
        if (job.decimalmark == '.') {
            value = value.replace(/,/g, ''); //remove thousands separators
        } else if (job.decimalmark == ',') {
            value = value.replace(/\./g, ''); //remove thousands separators
            value = value.replace(',', '.'); //replace decimal mark , by .
        }
        var patt = /^(\+|\-)?[0-9.]+$/;
        if (patt.test(value)){
            checkConstraints(pageid, qid, value, 0);
        } else {
            report(pageid, 'error', 'unclear value', qid);
        }
    }
}

function parseTemplate(text) {
    text = text
        .replace(/(\n|\r)/gm, '') //remove linebreaks
        .replace(/<!--.*?-->/g, '') //remove comments
        .replace(/<ref([^>]+)\/>/g, '') //remove self-closing reference tags
        .replace(/<ref((?!<\/ref>).)*<\/ref>/g, '') //remove references
        .replace(/<ref([^>]+)>/g, '') //remove reference tags
        .replace(/\s\s+/g, ' ') //remove multiple spaces
        .replace(/'{2,}/g, '') //remove some MediaWiki syntax
        .replace(new RegExp('{{\\s*(:?(' + templateprefixes.join('|') + '):\\s*)?' + job.templates + '\\s*', 'gi'), '{{' + job.template);
    var txt = text.split('{{' + job.template + '|');
    if (txt.length == 1) {
        return false;
    }
    text = txt[1];
    var patt = new RegExp('{{((?!}}|{{).)*}}', 'g');
    while (patt.test(text)) {
        text = text.replace(patt, ''); //remove all other templates
    }
    txt = text.split('}}');
    text = txt[0].replace(/\|((?!\]\]|\||\[\[).)*\]\]/g, ']]'); //simplify links
    var result = {};
    var unnamed = 0;
    $.each(text.split('|'), function(i, m) {
        var sp = m.split('='); // param = value
        var param = sp[0].trim();
        if (sp.length > 1) {
            var value = sp.slice(1).join('=').trim();
            if (value === '') {
                if (param in result) {
                    delete result[param];
                }
            } else {
                result[param] = value;
            }
        } else {
            unnamed++;
            if (param !== '') {
                result[unnamed] = param;
            } else if (unnamed in result) {
                delete result[unnamed];
            }
        }
    });
    return result;
}

function proceedOnePage() {
    if (run === 0) {
        reportStatus('stopped');
        return false;
    }
    var $pagelist = $('input[name="pagelist"]');
    if (i == $pagelist.length) {
        reportStatus('done<br />' + cntSuccess + ' successful edits, ' + cntError + ' errors');
        stopJob();
        return true;
    }
    reportStatus('running (' + i + '/' + $pagelist.length + ')');
    var el = $pagelist.eq(i);
    i++;
    if (el.prop('checked')) {
        setTimeout(function() {
            var id = el.attr('id');
            $.getJSON('https://' + job.siteid + '.' + job.project + '.org/w/api.php?callback=?', {
                action: 'query',
                prop: 'revisions',
                pageids: id,
                rvprop: 'content',
                format: 'json'
            })
            .done(function(data) {
                var qid = el.data('qid');
                if ('revisions' in data.query.pages[id]) {
                    var params = parseTemplate(data.query.pages[id].revisions[0]['*']);
                    if (params === false) {
                        report(id, 'error', 'template not found', qid);
                        proceedOnePage();
                        return;
                    }
                    if (job.parameter.length !== 0) {
                        var value = false;
                        for (var pp in job.parameter) {
                            if (job.parameter[pp] in params) {
                                value = params[job.parameter[pp]];
                                break;
                            }
                        }
                        if (value !== false) {
                            if (job.demo != 1 && bot === 0) {
                                delay = 5000;
                            }
                            handleValue(id, qid, value);
                        } else {
                            report(id, 'error', 'no value', qid);
                        }
                    } else {
                        var st = [],
                            values = [];
                        for (var kk = 1; kk <= 3; kk++) {
                            var value = params[job['aparameter'+kk]];
                            st.push(value !== undefined);
                            values.push(value);
                        }
                        if (st[0] !== false) {
                            if (job.demo != 1 && bot === 0) {
                                delay = 5000;
                            }
                            handleValue(id, qid, values);
                        } else {
                            report(id, 'error', 'no value', qid);
                        }
                    }
                } else {
                    report(id, 'error', 'page deleted', qid);
                }
                proceedOnePage();
            });
        }, delay);
    } else {
        proceedOnePage();
    }
}

function runJob($this) {
    if ($this.val() == 'demo') {
        job.demo = 1;
        $('#addvalues').attr('disabled', true);
    } else {
        job.demo = 0;
        $('#demo').attr('disabled', true);
    }
    $this
        .val('stop')
        .removeClass('run')
        .addClass('stop');
    $('#getpages').attr('disabled', true);
    $('input[name="pagelist"]').attr('disabled', true);
    run = 1;
    proceedOnePage();
}

function createCheckboxlist(pageids) {
    for (var j in pageids) {
        $('#result').append('<div><input type="checkbox" name="pagelist" id="' + pageids[j][0] + '" data-qid="' + pageids[j][1] + '" checked><span><a href="//' + job.siteid + '.' + job.project + '.org/wiki/' + encodeURIComponent(namespaces[job.namespace]) + ':' + encodeURIComponent(pageids[j][2]) + '" target="_blank">' + escapeHTML(pageids[j][2].replace(/_/g, ' ')) + '</a></span></div>');
    }
    $('#addvalues').show();
    $('#demo').show();
    $('#downloadlinks').show();
    stopLoading(pageids.length == 1 ? 'Found one page' : 'Found ' + pageids.length + ' pages');
}

function getPages() {
    job.template = job.template.capitalizeFirstLetter().replace(/_/g, ' ');
    $.getJSON('getcandidates.php?', {
        dbname: job.dbname,
        template: job.template,
        category: job.category,
        namespace: job.namespace,
        p: job.property,
        depth: job.depth,
        set: job.set,
        offset: job.offset,
        limit: job.limit
    })
    .done(function(pageids) {
        if (job.manuallist !== '') {
            var ml = $.map(job.manuallist.split('\n'), $.trim);
            pageids = pageids.filter(function(e) {return ml.indexOf(e[1]) > -1 || ml.indexOf(e[2].replace(/_/g, ' ')) > -1});
        }
        if (pageids.length > 0) {
            reportStatus('loading....');
            $.getJSON('https://' + job.siteid + '.' + job.project + '.org/w/api.php?callback=?', {
                action: 'query',
                prop: 'redirects',
                titles: 'Template:' + job.template,
                rdnamespace: 10,
                rdlimit: 500,
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
                createCheckboxlist(pageids);
                if (autorun === true) {
                    runJob($('#addvalues'));
                }
            });
        } else {
            stopLoading('nothing to do');
        }
    })
    .fail(function(jqxhr, textStatus, error) {
        var err = textStatus + ', ' + error;
        stopLoading('Request Failed: ' + err);
    });
}

function loadUnits(claims){
    var ids = [];
    for (var c in claims){
        if (claims[c].mainsnak.snaktype == 'novalue' || claims[c].mainsnak.datavalue.value['numeric-id'] == 21027105){
            $('select[name="unit"]').append('<option value="1">no unit</option>');
        } else if (claims[c].mainsnak.snaktype == 'value'){
            ids.push('Q'+claims[c].mainsnak.datavalue.value['numeric-id']);
        }
    }
    if (ids.length > 0){
        $.getJSON('https://www.wikidata.org/w/api.php?callback=?', {
            action: 'wbgetentities',
            ids: ids.join('|'),
            props: 'labels',
            languages: 'en',
            format: 'json'
        }).done(function(data) {
            for (var q in data.entities){
                if (data.entities[q].labels.en !== undefined){
                    $('select[name="unit"]').append('<option value="'+q+'">'+data.entities[q].labels.en.value+'</option>');
                } else {
                    $('select[name="unit"]').append('<option value="'+q+'">'+q+'</option>');
                }
            }
            if (tempunit !== false){
                $('select[name=unit] option').each(function() { this.selected = (this.value == tempunit); });
                tempunit = false;
            }
        });
    }
}

function showAdditionalFields() {
    reportStatus('');
    var val = $('input[name="property"]').val();
    if (val === '') {
        $('input[name="property"]').addClass('error');
        return;
    }
    var p = 'P' + val;
    $.getJSON('https://www.wikidata.org/w/api.php?callback=?', {
        action: 'wbgetentities',
        ids: p,
        props: 'claims|datatype|labels',
        languages: 'en',
        format: 'json'
    }).done(function(data) {
        if (data.entities[p].missing !== undefined){
            $('input[name="property"]').addClass('error');
            return;
        }
        switch (data.entities[p].datatype) {
            case 'wikibase-item':
                $('#wikisyntax').show();
                // no break here
            case 'external-id':
            case 'string':
            case 'url':
                $('#prefix').show();
                break;
            case 'time':
                $('.timeparameters').show();
                break;
            case 'quantity':
                if (data.entities[p].claims.P2237 !== undefined){
                    loadUnits(data.entities[p].claims.P2237);
                    $('.quantityparameters').show();
                } else {
                    reportStatus('P2237 (units used for this property) on property page missing');
                    $('input[name="property"]').addClass('error');
                }
                break;
        }
        if (data.entities[p].labels.en !== undefined){
            $('#plabel').text(data.entities[p].labels.en.value);
        }
    });
}

function hideAdditionalFields(){
    $('#plabel').text('');
    $('#wikisyntax').hide();
    $('#prefix').hide();
    $('.timeparameters').hide();
    $('.quantityparameters').hide();
    $('select[name="unit"]').html('');
}

function addAlias(){
    $('.parameters').append('<input type="text" name="parameter" value="">');
}

function loadJob() {
    $('#getpages').attr('disabled', true);
    $('.permalink').show();
    $('#downloadlinks').hide();
    $.ajax({
        type: 'GET',
        url: '../oauth.php',
        data: {
            action: 'userinfo'
        }
    })
    .done(function(data) {
        if ('error' in data) {
            stopLoading('You haven\'t authorized this application yet! Go <a href="../index.php?action=authorize" target="_parent">here</a> to do that.');
            return;
        }
        if (data.query.userinfo.groups.indexOf('bot') > -1){
            bot = 1;
        }
        $('#result').html('');
        $('#addvalues').hide();
        $('#demo').hide();
        i = 0;
        cntSuccess = 0;
        cntError = 0;

        job = {'parameter' : []};
        var fields = $( 'form' ).serializeArray();
        $.each( fields, function( i, field ) {
            if (field.name != 'parameter'){
                job[field.name] = field.value.trim();
            } else if (field.value !== ''){

                job[field.name].push(field.value.trim());
            }
        } );
        job.property = 'P' + job.property;

        if (job.siteid === '') {
            $('input[name="siteid"]').addClass('error');
        }
        if (job.project === '' || $.inArray(job.project, allProjects) == -1) {
            $('input[name="project"]').addClass('error');
        }
        if (job.template === '') {
            $('input[name="template"]').addClass('error');
        }
        if (job.parameter.length === 0 && job.aparameter1 === '') {
            $('input[name="parameter"]').addClass('error');
        }
        if (job.property == 'P') {
            $('input[name="property"]').addClass('error');
        }
        if (job.namespace === '') {
            $('input[name="namespace"]').addClass('error');
        }
        if (job.limit === '') {
            $('input[name="limit"]').addClass('error');
        }
        if (job.category !== '' && job.depth === '') {
            $('input[name="depth"]').addClass('error');
        }
        if ($('.error').length > 0) {
            stopLoading('');
            return;
        }

        job.siteid = getSiteid(job.siteid, job.project);
        if (job.set === undefined){
            job.set = 0;
        }
        if (job.offset === '') {
            job.offset = 0;
        }
        if (isNaN(parseInt(job.limityear))) {
            job.limityear = 1926;
        }
        $.getJSON('https://www.wikidata.org/w/api.php?callback=?', {
            action: 'wbgetentities',
            ids: job.property,
            props: 'claims|datatype',
            format: 'json'
        }).done(function(data) {
            job.datatype = data.entities[job.property].datatype;
            // TODO: monolingualtext, geocoordinate (math?)
            if ($.inArray(job.datatype, ['commonsMedia', 'external-id', 'quantity', 'string', 'time', 'url', 'wikibase-item']) === -1) {
                $('input[name="property"]').addClass('error');
                stopLoading('datatype ' + job.datatype + ' is not yet supported');
                return;
            }
            if (data.entities[job.property].claims !== undefined && data.entities[job.property].claims.P31 !== undefined) {
                for (var i in data.entities[job.property].claims.P31) {
                    if (
                        data.entities[job.property].claims.P31[i].mainsnak.snaktype == 'value' &&
                        data.entities[job.property].claims.P31[i].mainsnak.datavalue.value['numeric-id'] === 18644427
                    ) {
                        $('input[name="property"]').addClass('error');
                        stopLoading('this property is deprecated');
                        return;
                    }
                }
            }
            reportStatus('loading..');
            loadSiteinfo();
        });
    });
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

    $('.permalink').mouseenter(function() {
        var url = '//tools.wmflabs.org/pltools/harvesttemplates/?';
        var params = $( 'form input:visible, form select:visible' ).serializeArray();
        $('form input[type=checkbox]:not(:checked)').each(function() {
            params.push({ name: this.name, value: '0' });
        });
        $.each( params, function( i, field ) {
            url += field.name+'='+field.value+'&';
        });
        $(this).attr('href', url);
    });

    $('.download').click(function(e) {
        toFile.apply(this, [$(this).text()]);
    });

    $('#addalias').click(function(e) {
        e.preventDefault();
        addAlias();
    });

    $('input[type="submit"]').click(function(e) {
        e.preventDefault();
        var $this = $(this);
        if ($this.val() == 'stop') {
            stopJob();
            return;
        }
        if ($this.val() == 'get pages') {
            autorun = false;
            loadJob();
            return;
        }
        if (job.demo == 1) {
            $('#result').find('div').each(function(index, value) {
                $(this).removeClass().find('.value').html('');
            });
        }
        runJob($this);
    });

    if (autoload === true) {
        autoload = false;
        loadJob();
    }

});
