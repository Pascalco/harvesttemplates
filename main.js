/*
 * To the extent possible under law, the author(s) have dedicated all copyright
 * and related and neighboring rights to this software to the public domain
 * worldwide. This software is distributed without any warranty.
 *
 * See <http://creativecommons.org/publicdomain/zero/1.0/> for a copy of the
 * CC0 Public Domain Dedication.
*/
var allProjects = ['wikipedia','wikisource','wikivoyage','wikinews','wikibooks','wikiquote','commons'];
var run = 0;
var uniqueValue = [];
var regex = false;
var delay = 1000;
var job = false;
var i = 0;

String.prototype.capitalizeFirstLetter = function() {
    return this.charAt(0).toUpperCase() + this.slice(1);
};

function report( pageid, status, value, title ){
    if ( status == 'success' && job.datatype == 'wikibase-item' ){
        value = '<a href="//www.wikidata.org/wiki/'+value+'" target="_blank">'+value+'</a>';
    }
    if ( status == 'success' ){
        $('#' + pageid).next().append( ' → <a href="//www.wikidata.org/wiki/'+title+'" target="_blank">'+title+'</a>: added value <i>'+value+'</i>' );
    } else {
        delay = 500;
        $('#' + pageid).next().append( ' → '+value );
    }
    $('#' + pageid).parent().addClass( status );
}

function reportStatus( status ){
    $('#status').html( status );
}

function stopJob(){
    run = 0;
    $('#addvalues').val( 'add values' );
    $('#addvalues').removeClass( 'stop' );
    $('#addvalues').addClass( 'run' );
    $( 'input[name="pagelist"]' ).attr( 'disabled', false );
}

function createConstraints(){
    singleValue = [];
    uniqueValue = [];
    $.ajax({
        type: 'GET',
        url: 'https://query.wikidata.org/bigdata/namespace/wdq/sparql?',
        data: {query: 'PREFIX wdt: <http://www.wikidata.org/prop/direct/>SELECT ?value WHERE {?item wdt:'+job.p+' ?value .}', format: 'json'},
        dataType: 'json',
        async: false
    }).done(function( data ) {
        for ( var row in data.results.bindings ){
            uniqueValue.push( data.results.bindings[row].value.value );
        }
        $.ajax({
            type: 'GET',
            url: 'getregex.php',
            data: {p: job.p},
            async: false
        }).done(function(data) {
            regex = data;
        });
    });
}

function getWpEditionId( lang, project ){
    var qid = 0;
    if ( project == 'wikipedia' ){
        project = 'wiki';
    } else if( project == 'commons' || lang == 'commons' ){
        project = 'commons';
        lang = '';
    } else if ( project == 'wikidata' || lang == 'wikidata' ){
        project = 'wikidata';
        lang = '';
    }
    $.ajax({
        type: 'GET',
        url: 'wpeditionids.json',
        dataType: 'json',
        async: false
    }).done(function( data ) {
        qid = data[lang+project];
    });
    return qid;
}

function setSource( item, guid ){
    var sources = [
        {type : 'wikibase-entityid', q: item, p : 'P143', numericid: job.wbeditionid}
    ];
    $.ajax({
        type: 'GET',
        url: '../oauth.php',
        data: {action : 'addSource', guid : guid, sources : sources}
    });
}

function addValue( pageid, item, title, value ){
    if ( job.datatype == 'string' || job.datatype == 'commonsMedia' || job.datatype == 'url'){
        claim = {type : 'string', q: item, p: job.p, text: value};
    } else if ( job.datatype == 'wikibase-item'){
        claim = {type : 'wikibase-entityid', q: item, p: job.p, numericid: value.substring(1)};
    } else {
        reportStatus( 'not supported datatype' );
        return false;
    }
    $.ajax({
        type: 'GET',
        url: '../oauth.php',
        data: {action : 'createClaim', claim : claim}
    })
    .done(function( data ){
        if ( data.indexOf('createdClaim') > -1 ){
            var res = data.split('|');
            var guid = res[1];
            setSource( item, guid );
            report( pageid, 'success', value, item );
        } else {
            report( pageid, 'fatalerror', data, title );
        }
    });
}

function handleValue( pageid, item, title, value ){
     if ( job.datatype == 'string' || job.datatype == 'url' ){
        if ( regex !== false ){
            var patt = new RegExp('^'+regex+'$');
            if ( patt.test( value ) === false){
                report( pageid, 'error', 'format violation of value <i>'+value+'</i>', title );
                return false;
            }
        }
        if ( uniqueValue.indexOf( value ) != -1 ){
            report( pageid, 'error', 'unique value violation', title );
            return false;
        }
        uniqueValue.push( value );
        addValue( pageid, item, title, value );
    }
    else if ( job.datatype == 'wikibase-item' ){
        var res = value.match(/\[\[([^\|\]]+)/);
        if (res !== null){
            res = res[1];
        } else {
            if ( job.wikisyntax ){
                res = value;
            } else {
                report( pageid, 'error', 'no target page found', title );
                return 0;
            }
        }
        if ( res.indexOf( '#' ) != -1 ){
            report( pageid, 'error', 'no target page found', title );
            return 0;
        }
        $.getJSON( 'https://'+job.lang+'.'+job.project+'.org/w/api.php?callback=?', {
            action : 'query',
            prop : 'pageprops',
            titles : res,
            format: 'json'
        })
        .done( function( data ) {
            for (var m in data.query.pages ){
                if ( m != '-1' ){
                    if ( 'pageprops' in data.query.pages[m] ){
                        if ( 'wikibase_item' in data.query.pages[m].pageprops ){
                            newvalue = data.query.pages[m].pageprops.wikibase_item;
                            $.getJSON( 'https://www.wikidata.org/w/api.php?callback=?', {
                                action : 'wbgetentities',
                                ids : newvalue,
                                format: 'json'
                            })
                            .done( function( data2 ) {
                                if ('P31' in data2.entities[newvalue].claims){
                                    if (data2.entities[newvalue].claims.P31[0].mainsnak.datavalue.value['numeric-id'] == 4167410){
                                        report( pageid, 'error', 'target page is a disambiguation page', title );
                                        return 0;
                                    }
                                }
                                addValue( pageid, item, title, newvalue );
                            });
                        } else {
                            report( pageid, 'error', 'target has no Wikidata item', title );
                        }
                    } else {
                        report( pageid, 'error', 'target has no Wikidata item', title );
                    }
                } else {
                    report( pageid, 'error', 'no target page found', title );
                }
            }
        });
    } else if ( job.datatype == 'commonsMedia' ){
        value = value.replace( '_', ' ' );
        $.getJSON( 'https://commons.wikimedia.org/w/api.php?callback=?', {
            action : 'query',
            titles : 'File:'+value,
            format: 'json'
        })
        .done( function ( data ) {
            if ('-1' in data.query.pages ){
                report( pageid, 'error', 'File <i>'+value+'</i> does not exists on Commons', title );
                return false;
            }
            if ( uniqueValue.indexOf( value ) != -1 ){
                report( pageid, 'error', 'unique value violation', title );
                return false;
            }
            uniqueValue.push( value );
            addValue( pageid, item, title, value );
        });
    }
}

function parseTemplate( text, pageid, wikidataid, title ){
    var open = 1;
    var save = 0;
    var result = '';
    text = text.replace( new RegExp( '{{\\s*'+job.templates, 'i' ), '{{'+job.template );
    var txt = text.split( '{{'+job.template );
    if ( txt.length == 1 ){
        report( 'fatalerror', 'unknown error', title );
        return false;
    }
    parts = txt[1].split( /(\{\{|\}\}|\||\=|\[\[|\]\])/ );
    $.each(parts,function(i,m){
        m = m.trim();
        if (save == 1 && open == 1 && m == '|') return false; //end of value
        if (m == '{{' || m == '[[') open += 1; //one level deeper
        if (m == '}}' || m == ']]') open -= 1; //one level higher
        if (open === 0) return false; //end of template
        if (save == 1 && (result !== '' || m != '=')) result += m;
        if (open == 1 && m.toLowerCase() == job.parameter.toLowerCase()) save = 1; //found parameter on the correct level
    });
    if ( result === '' && !isNaN( job.parameter ) ){
        parts = txt[1].split( /(\||\}\})/ );
        result = parts[2*job.parameter];
    }
    if ( result !== '' ){
        delay = 5000;
        handleValue( pageid, wikidataid, title, result );
    } else {
        report( pageid, 'error', 'no value', title );
    }
}

function proceedOnePage(){
    if ( run === 0 ){
        reportStatus( 'stopped' );
        return false;
    }
    if ( i == $('input[name="pagelist"]').length ){
        reportStatus( 'done' );
        stopJob();
        return true;
    }
    reportStatus( 'running ('+i+'/'+$('input[name="pagelist"]').length+')' );
    el = $( 'input[name="pagelist"]' ).eq( i );
    i += 1;
    if ( el.prop( 'checked' ) ){
        setTimeout(function(){
            $.getJSON( 'https://'+job.lang+'.'+job.project+'.org/w/api.php?callback=?', {
                action : 'query',
                prop : 'revisions',
                pageids : el.attr('id'),
                rvprop: 'content',
                format: 'json'
            })
            .done( function( data2 ) {
                parseTemplate( data2.query.pages[el.attr('id')].revisions[0]['*'], el.attr('id'), el.attr('data-qid'), data2.query.pages[el.attr('id')].title );                
                proceedOnePage();
            });
        }, delay );
    } else {
        proceedOnePage();
    }
}

function createCheckboxlist( pageids ){
    for ( var j in pageids ){
        $('#result').append( '<div><input type="checkbox" name="pagelist" id="'+pageids[j][0]+'" data-qid="'+pageids[j][1]+'" checked><span><a href="//'+job.lang+'.'+job.project+'.org/wiki/'+pageids[j][2]+'" target="_blank">'+pageids[j][2].replace(/_/g,' ')+'</a></span></div>' );
    }
    $('#addvalues').show();
    reportStatus('Found '+pageids.length+' pages');
}

function getPages() {
    $.getJSON( 'getcandidates.php?', {
        lang : job.lang,
        project : job.project,
        template : job.template,
        category : job.category,
        p: job.p
    })
    .done( function( pageids ) {
        reportStatus( 'loading....' );
        $.getJSON( 'https://'+job.lang+'.'+job.project+'.org/w/api.php?callback=?', {
            action : 'query',
            prop : 'redirects',
            titles : 'Template:'+job.template,
            rdnamespace: 10,
            format: 'json'
        })
        .done( function( data ) {
            job.templates = '('+job.template+'|'+job.template.replace(' ','_');
            for ( var m in data.query.pages ){
                if ('redirects' in data.query.pages[m]){
                    for (var red in data.query.pages[m].redirects){
                        var title = data.query.pages[m].redirects[red].title.split(':',2);
                        job.templates += '|'+title[1]+'|'+title[1].replace(' ','_');
                    }
                }
            }
            job.templates += ')';
            if ( pageids.length > 0 ){
                createCheckboxlist( pageids );
            } else {
                reportStatus( 'nothing to do' );
            }
        });
    })
    .fail(function( jqxhr, textStatus, error ) {
        var err = textStatus + ', ' + error;
        reportStatus( 'Request Failed: ' + err );
    });
}

$(document).ready( function(){
    $( 'input' ).change( function(){
        $(this).removeClass( 'error' );
    });
    $( 'input[name="property"]' ).change(function (){
        $.getJSON( 'https://www.wikidata.org/w/api.php?callback=?',{
            action : 'wbgetentities',
            ids : 'P'+$( 'input[name="property"]' ).val(),
            format: 'json'
        },function( data ) {
            if ( data.entities['P'+$( 'input[name="property"]' ).val()].datatype == 'wikibase-item' ){
                $( '#wikisyntax' ).show();
            } else{
                $( '#wikisyntax' ).hide();
            }
        });
    });

    $( 'input[type="submit"]' ).click( function( e ) {
        e.preventDefault();
        if ( $(this).attr('id') == 'getpages' ){
            $.ajax({
                type: 'GET',
                url: '../oauth.php',
                data: {action : 'userinfo'}
            })
            .done(function( data ){
                if ( 'error' in data ){
                    reportStatus( 'You haven\'t authorized this application yet! Go <a href="../index.php?action=authorize" target="_parent">here</a> to do that.' );
                } else {
                    var error = 0;
                    $('#result').html( '' );
                    $('#addvalues').hide();
                    stopJob();
                    i = 0;
                    job = {
                        p: 'P'+$('input[name="property"]').val(),
                        lang: $('input[name="lang"]').val(),
                        project: $('input[name="project"]').val(),
                        template: $('input[name="template"]').val().capitalizeFirstLetter().replace('_',' '),
                        parameter: $('input[name="parameter"]').val(),
                        category: $('input[name="category"]').val(),
                        wikisyntax: $('input[name="wikisyntax"]').prop('checked')
                    };
                    if ( job.lang === '' ){
                        $( 'input[name="lang"]' ).addClass( 'error' );
                        error = 1;
                    }
                    if (job.project === '' || $.inArray(job.project, allProjects) == -1){
                        $( 'input[name="project"]' ).addClass( 'error' );
                        error = 1;
                    }
                    if ( job.template === '' ){
                        $( 'input[name="template"]' ).addClass( 'error' );
                        error = 1;
                    }
                    if ( job.parameter === '' ){
                        $( 'input[name="parameter"]' ).addClass( 'error' );
                        error = 1;
                    }
                    if ( job.p == 'P' ){
                        $( 'input[name="property"]' ).addClass( 'error' );
                        error = 1;
                    }
                    if ( error === 0 ){
                        job.wbeditionid = getWpEditionId( job.lang, job.project );
                        $.getJSON('https://www.wikidata.org/w/api.php?callback=?',{
                            action : 'wbgetentities',
                            ids : job.p,
                            format: 'json'
                        },function( data ) {
                            job.datatype = data.entities[job.p].datatype;
                            if ( job.datatype == 'string' || job.datatype == 'wikibase-item' || job.datatype == 'commonsMedia' || job.datatype == 'url' ){
                                reportStatus( 'loading..' );
                                createConstraints();
                                reportStatus( 'loading...' );
                                getPages();
                            } else {
                                reportStatus( 'datatype '+job.datatype+' is not yet supported');
                            }
                        });
                    }
                }
            });
        } else if ( $(this).attr('id') == 'addvalues' && $(this).val() == 'add values' ){
            run = 1;
            $( 'input[name="pagelist"]' ).attr( 'disabled', true );
            $(this).val('stop');
            $(this).removeClass( 'run' );
            $(this).addClass( 'stop' );
            proceedOnePage();
        } else {
            stopJob();
        }
    });
});
