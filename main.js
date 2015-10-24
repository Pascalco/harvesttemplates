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

String.prototype.capitalizeFirstLetter = function() {
    return this.charAt(0).toUpperCase() + this.slice(1);
};

function report( status, value, title, job ){
    if ( status == 'success' && job.datatype == 'wikibase-item' ){
        value = '<a href="//www.wikidata.org/wiki/'+value+'" target="_blank">'+value+'</a>';
    }
    if ( status == 'success' ){
        $('#result').append( '<span class="success"><a href="//www.wikidata.org/wiki/'+title+'" target="_blank">'+title+'</a>: added value <i>'+value+'</i></span>' );
    } else {
        delay = 500;
        $('#result').append( '<span class="'+status+'"><a href="//'+job.lang+'.'+job.project+'.org/wiki/'+title+'" target="_blank">'+title+'</a>: '+value+'</span>' );
    }
}

function reportStatus( status ){
    $('#status').html( status );
}

function stopJob(){
    run = 0;
    $('input[name="submit"]').val( 'run' );
    $('input[name="submit"]').removeClass( 'stop' );
    $('input[name="submit"]').addClass( 'run' );
}

function createConstraints( job ){
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

function setSource( item, guid, job ){
    var sources = [
        {type : 'wikibase-entityid', q: item, p : 'P143', numericid: job.wbeditionid}
    ];
    $.ajax({
        type: 'GET',
        url: '../oauth.php',
        data: {action : 'addSource', guid : guid, sources : sources}
    });
}

function addValue( item, title, value, job ){
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
            setSource( item, guid, job );
            report( 'success', value, item, job );
        } else {
            report( 'fatalerror', data, title, job );
        }
    });
}

function handleValue( item, title, value, job ){
     if ( job.datatype == 'string' || job.datatype == 'url' ){
        if ( regex !== false ){
            var patt = new RegExp('^'+regex+'$');
            if ( patt.test( value ) === false){
                report( 'error', 'format violation of value <i>'+value+'</i>', title, job );
                return false;
            }
        }
        if ( uniqueValue.indexOf( value ) != -1 ){
            report( 'error', 'unique value violation', title, job );
            return false;
        }
        uniqueValue.push( value );
        addValue( item, title, value, job );
    }
    else if ( job.datatype == 'wikibase-item' ){
        var res = value.match(/\[\[([^\|\]]+)/);
        if (res !== null){
            res = res[1];
        } else {
            if ( job.wikisyntax ){
                res = value;
            } else {
                report( 'error', 'no target page found', title, job );
                return 0;
            }
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
                            addValue( item, title, newvalue, job );
                        } else {
                            report( 'error', 'target has no Wikidata item', title, job );
                        }
                    } else {
                        console.log(data.query.pages[m]);
                        report( 'error', 'target has no Wikidata item', title, job );
                    }
                } else {
                    report( 'error', 'no target page found', title, job );
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
                report( 'error', 'File <i>'+value+'</i> does not exists on Commons', title, job );
                return false;
            }
            if ( uniqueValue.indexOf( value ) != -1 ){
                report( 'error', 'unique value violation', title, job );
                return false;
            }
            uniqueValue.push( value );
            addValue( item, title, value, job );
        });
    }
}

function parseTemplate( text, pageid, title, job ){
    var open = 1;
    var save = 0;
    var result = '';
    text = text.replace( new RegExp( '{{\\s*'+job.templates, 'i' ), '{{'+job.template );
    var txt = text.split( '{{'+job.template );
    if ( txt.length == 1 ){
        report( 'fatalerror', 'unknown error', title, job );
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
        handleValue( pageid[1], title, result, job );
    } else {
        report( 'error', 'no value', title, job );
    }
}

function proceedOnePage( i, pageids, job ){
    if ( run === 0 ){
        reportStatus( 'stopped' );
        return false;
    }
    setTimeout(function(){
        $.getJSON( 'https://'+job.lang+'.'+job.project+'.org/w/api.php?callback=?', {
            action : 'query',
            prop : 'revisions',
            pageids : pageids[i][0],
            rvprop: 'content',
            format: 'json'
        })
        .done( function( data2 ) {
            parseTemplate( data2.query.pages[pageids[i][0]].revisions[0]['*'], pageids[i], data2.query.pages[pageids[i][0]].title, job );
            if ( i < pageids.length-1 ){
                reportStatus( 'running ('+(i+1)+'/'+pageids.length+')' );
                proceedOnePage( i+1, pageids, job );
            } else {
                reportStatus( 'done' );
                stopJob();
            }
        });
    }, delay );
}

function getPages( job ) {
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
                proceedOnePage( 0, pageids, job );
            } else {
                reportStatus( 'nothing to do' );
                stopJob();
            }
        });
    })
    .fail(function( jqxhr, textStatus, error ) {
        var err = textStatus + ', ' + error;
        reportStatus( 'Request Failed: ' + err );
        stopJob();
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

    $( "#spec" ).submit( function( e ) {
        e.preventDefault();
        if ( $( 'input[name="submit"]' ).val() == 'run' ){
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
                        $( 'input[name="submit"]' ).val( 'stop' );
                        $( 'input[name="submit"]' ).removeClass( 'run' );
                        $( 'input[name="submit"]' ).addClass( 'stop' );
                        job.wbeditionid = getWpEditionId( job.lang, job.project );
                        $.getJSON('https://www.wikidata.org/w/api.php?callback=?',{
                            action : 'wbgetentities',
                            ids : job.p,
                            format: 'json'
                        },function( data ) {
                            job.datatype = data.entities[job.p].datatype;
                            if ( job.datatype == 'string' || job.datatype == 'wikibase-item' || job.datatype == 'commonsMedia' || job.datatype == 'url' ){
                                run = 1;
                                reportStatus( 'loading..' );
                                createConstraints( job );
                                reportStatus( 'loading...' );
                                getPages( job );
                            } else {
                                reportStatus( 'datatype '+job.datatype+' is not yet supported');
                                stopJob();
                            }
                        });
                    }
                }
            });
        } else {
            stopJob();
        }
    });
});
