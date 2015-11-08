/*
 * To the extent possible under law, the author(s) have dedicated all copyright
 * and related and neighboring rights to this software to the public domain
 * worldwide. This software is distributed without any warranty.
 *
 * See <http://creativecommons.org/publicdomain/zero/1.0/> for a copy of the
 * CC0 Public Domain Dedication.
*/
var allProjects = ['commons','mediawiki','wikibooks','wikidata','wikimedia','wikinews','wikipedia','wikiquote','wikisource','wikivoyage'];
var run = 0;
var uniqueValue = [];
var regex = false;
var delay = 1000;
var job = false;
var i = 0;

String.prototype.capitalizeFirstLetter = function() {
    return this.charAt(0).toUpperCase() + this.slice(1);
};

function report( pageid, status, value, qid ){
    if ( status == 'success' && job.datatype == 'wikibase-item' ){
        value = '<a href="//www.wikidata.org/wiki/'+value+'" target="_blank">'+value+'</a>';
    }
    if ( status == 'success' ){
        $('#' + pageid).next().append( '<span class="value"> → <a href="//www.wikidata.org/wiki/'+qid+'" target="_blank">'+qid+'</a> → added value <i>'+value+'</i></span>' );
    } else {
        delay = 500;
        $('#' + pageid).next().append( '<span class="value"> → <a href="//www.wikidata.org/wiki/'+qid+'" target="_blank">'+qid+'</a> → '+value+'</span>' );

    }
    $('#' + pageid).parent().addClass( status );
}

function reportStatus( status ){
    $('#status').html( status );
}

function stopJob(){
    run = 0;
    if ( $('.stop').attr('id') == 'addvalues' ){
        $('#addvalues').val( 'add values' );
        $('#addvalues').removeClass( 'stop' );
        $('#addvalues').addClass( 'run' );
        $('#demo').attr( 'disabled', false );
    } else if ( $('.stop').attr('id') == 'demo' ){
        $('#demo').val( 'demo' );
        $('#demo').removeClass( 'stop' );
        $('#demo').addClass( 'run' );
        $('#addvalues').attr( 'disabled', false );
        i=0;
    }
    $( 'input[name="pagelist"]' ).attr( 'disabled', false );

}

function createConstraints(){
    if ( job.datatype == 'string' || job.datatype == 'commonsMedia' || job.datatype == 'url' ){
        uniqueValue = [];
        $.ajax({
            type: 'GET',
            url: 'https://query.wikidata.org/bigdata/namespace/wdq/sparql?',
            data: {query: 'PREFIX wdt: <http://www.wikidata.org/prop/direct/>SELECT ?value WHERE {?item wdt:'+job.p+' ?value .} GROUP BY ?value', format: 'json'},
            dataType: 'json',
            async: false
        }).done(function( data ) {
            for ( var row in data.results.bindings ){
                uniqueValue.push( data.results.bindings[row].value.value );
            }
        });
    }
    $.ajax({
        type: 'GET',
        url: 'getconstraints.php',
        data: {p: job.p},
        async: false
    }).done( function( data ) {
        if ( data['format'] !== undefined ){
            regex = data['format'];
        }
    });
}


function getSiteid( siteid, project ){
    if ( project == 'mediawiki' || project == 'wikidata' ){
        return 'www';
    } else {
        return siteid.toLowerCase();
    }
}

function getLanguage( siteid, project ){
    if ( project == 'mediawiki' || project == 'wikidata' || project == 'wikimedia' ){
        return 'en';
    }
    langExceptions = {no: 'nb', simple: 'en', als: 'gsw'}
    if (siteid in langExceptions){
        return langExceptions[siteid];
    }
    return siteid.toLowerCase();
}

function getDbname( siteid, project ){
    var qid = 0;
    if ( project == 'wikipedia' ){
        return siteid+'wiki';
    } else if ( siteid == 'commons' && project == 'wikimedia' ){
        return 'commonswiki';
    } else if ( siteid == 'species' && project == 'wikimedia' ){
        return 'specieswiki';
    } else if ( siteid == 'meta' && project == 'wikimedia' ){
        return 'metawiki';
    } else if ( siteid == 'www' && project == 'wikidata' ){
        return 'wikidatawiki';
    } else if ( siteid == 'www' && project == 'mediawiki' ){
        return 'mediawikiwiki';
    } else {
        return siteid+project;
    }
}

function getWpEditionId( dbname ){
    $.ajax({
        type: 'GET',
        url: 'wpeditionids.json',
        dataType: 'json',
        async: false
    }).done(function( data ) {
        qid = data[dbname];
    });
    return qid;
}

function setSource( qid, guid ){
    var sources = [
        {type : 'wikibase-entityid', q: qid, p : 'P143', numericid: job.wbeditionid}
    ];
    $.ajax({
        type: 'GET',
        url: '../oauth.php',
        data: {action : 'addSource', guid : guid, sources : sources}
    });
}

function addValue( pageid, qid, value ){
    if ( job.datatype == 'string' || job.datatype == 'commonsMedia' || job.datatype == 'url' ){
        claim = {type : 'string', q: qid, p: job.p, text: value};
    } else if ( job.datatype == 'wikibase-item' ){
        claim = {type : 'wikibase-entityid', q: qid, p: job.p, numericid: value.substring(1)};
    } else if ( job.datatype == 'time' ){
        var precision = 9;
        if ( value.substring(5,7) != '00' ){
           precision = 10;
           if ( value.substring(8,10) != '00' ){
               precision = 11;
           }
        }
        claim = {type : 'time', q: qid, p : job.p , date : '+'+value+'T00:00:00Z', precision : precision, calender: job.calender.model}
    } else {
        reportStatus( 'not supported datatype: '+job.datatype );
        return false;
    }
    if ( job.demo == 1){
        report( pageid, 'success', value, qid );
    } else {
        $.ajax({
            type: 'GET',
            url: '../oauth.php',
            data: {action : 'createClaim', claim : claim}
        })
        .done(function( data ){
            if ( data.indexOf('createdClaim') > -1 ){
                var res = data.split('|');
                var guid = res[1];
                setSource( qid, guid );
                report( pageid, 'success', value, qid );
            } else {
                report( pageid, 'error', data, qid );
            }
        });
    }
}

function checkConstraints( pageid, qid, value){
    // format check
    if ( job.datatype == 'string' || job.datatype == 'url'){
        if ( regex !== false ){
            var patt = new RegExp('^('+regex+')$');
            if ( patt.test( value ) == false){
                report( pageid, 'error', 'format violation of value <i>'+value+'</i>', qid );
                return false;
            }
        } else {
            reportStatus( 'no format expression found' );
            return false;
        }
    }
    // unique value check
    if ( job.datatype == 'string' || job.datatype == 'url' || job.datatype == 'commonsMedia' ){
        if ( uniqueValue.indexOf( value ) != -1 ){
            report( pageid, 'error', 'unique value violation', qid );
            return false;
        }
        if (job.demo != 1){
            uniqueValue.push( value );
        }
    }
    //disam check
    if ( job.datatype == 'wikibase-item' ){
        $.getJSON( 'https://www.wikidata.org/w/api.php?callback=?', {
            action : 'wbgetentities',
            ids : value,
            format: 'json'
        })
        .done( function( data2 ) {
            if ('P31' in data2.entities[value].claims){
                if (data2.entities[value].claims.P31[0].mainsnak.datavalue.value['numeric-id'] == 4167410){
                    report( pageid, 'error', 'target page is a disambiguation page', qid );
                    return false;
                }
            }
            addValue( pageid, qid, value );
        });
    } else {
       addValue( pageid, qid, value );
    }
}

function parseDate( value ){
    var date = false;
    $.ajax({
        type: 'GET',
        url: 'monthnames.json',
        dataType: 'json',
        async: false
    }).done( function( monthnames ) {
        value = value.replace( /–|-|—/g, '-' );
        digits = {'०':0,'१':1,'२':2,'३':3,'४':4,'५':5,'६':6,'७':7,'८':8,'९':9}
        roman = {1:'I',2:'II',3:'III',4:'IV',5:'V',6:'VI',7:'VII',8:'VIII',9:'IX',10:'X',11:'XI',12:'XII'}
        $.each(digits, function( k, v) {
            r = new RegExp(k,'g');
            value = value.replace( r , v )
        });
        //only year
        r = new RegExp( '^(\\d{4})$' );
        var res = value.match( r );
        if ( res !== null){
            date = res[1]+'-00-00';
        }
        $.each ( ( monthnames[job.lang]||{} ) , function ( name , num ) {
            // month and year
            r = new RegExp( '^('+name+'|'+name.substr(0,3)+') (\\d{4})$', 'i' );
            var res = value.match( r );
            if ( res !== null){
                date = res[2]+'-'+num+'-00';
            }
            // day, month, year
            r = new RegExp( '^(\\d{1,2})( |\\. |º |er | - an? de | de | d\')?('+name+')(,| del?|, इ.स.| พ.ศ.)? (\\d{4})$', 'i' );
            var res = value.match( r );
            if ( res !== null){
                date = res[5]+'-'+num+'-'+res[1];
            }
            // month, day, year
            r = new RegExp( '^('+name+'|'+name.substr(0,3)+') (\\d{1,2})t?h?\\,? (\\d{4})$', 'i' );
            var res = value.match( r );
            if ( res !== null){
                date = res[3]+'-'+num+'-'+res[2];
            }
            // year, month, day
            r = new RegExp( '^(\\d{4})(e?ko|\\.|,)? ('+name+')(aren)? (\\d{1,2})(a|ean|an)?$', 'i' );
            var res = value.match( r );
            if ( res !== null){
                date = res[1]+'-'+num+'-'+res[5];
            }
        } );
        for ( var num = 1; num <= 12; num++ ) {
            // day, month (number), year
            r = new RegExp( '^(\\d{1,2})([. /]+| tháng )(0?'+num+'|'+roman[num]+')([., /]+| năm )(\\d{4})$' ,'i' );
            var res = value.match( r );
            if ( res !== null){
                date = res[5]+'-'+num+'-'+res[1];
            }
            // year, month (number), day
            r = new RegExp( '^(\\d{4})( - |/)(0?'+num+'|'+roman[num]+')( - |/)(\\d{1,2})$', 'i' );
            var res = value.match( r );
            if ( res !== null){
                date = res[1]+'-'+num+'-'+res[5];
            }
        }
        // Japanese/Chinese/Korean
        r = new RegExp( '^(\\d{4})(年|年\）|年[〈（\(][^）〉\)]+[〉|）|\)]|년)$' );
        var res = value.match( r );
        if ( res !== null){
            date = res[1]+'-00-00';
        }
        r = new RegExp( '^(\\d{4})(年|年\）|年[〈（\(][^）〉\)]+[〉|）|\)]|년 )(\\d{1,2})(月|월)$' );
        var res = value.match( r );
        if ( res !== null){
            date = res[1]+'-'+res[3]+'-00';
        }
        r = new RegExp( '^(\\d{4})(年|年\）|年[〈（\(][^）〉\)]+[〉|）|\)]|년 )(\\d{1,2})(月|월 )(\\d{1,2})(日|일)$' );
        var res = value.match( r );
        if ( res !== null){
            date = res[1]+'-'+res[3]+'-'+res[5];
        }
        if (date !== false){
            date = date.replace( /-(\d)-/, '-0\$1-' );
            date = date.replace( /-(\d)$/, '-0\$1' );
        }
    });
    return date;
}

function handleValue( pageid, qid, value ){
    if ( job.datatype == 'string'){
        checkConstraints( pageid, qid, job.prefix + value );
    } else if ( job.datatype == 'url' ){
        checkConstraints( pageid, qid, value );
    } else if ( job.datatype == 'wikibase-item' ){
        var res = value.match(/^\[\[([^\|\]]+)/);
        if (res !== null){
            res = res[1];
        } else {
            if ( job.wikisyntax ){
                res = value;
            } else {
                report( pageid, 'error', 'no target page found', qid );
                return 0;
            }
        }
        if ( res.indexOf( '#' ) != -1 ){
            report( pageid, 'error', 'no target page found', qid );
            return 0;
        }
        $.getJSON( 'https://'+job.siteid+'.'+job.project+'.org/w/api.php?callback=?', {
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
                            checkConstraints( pageid, qid, newvalue );
                        } else {
                            report( pageid, 'error', 'target has no Wikidata item', qid );
                        }
                    } else {
                        report( pageid, 'error', 'target has no Wikidata item', qid );
                    }
                } else {
                    report( pageid, 'error', 'no target page found', qid );
                }
            }
        });
    } else if ( job.datatype == 'commonsMedia' ){
        value = value.replace( /_/g, ' ' );
        $.getJSON( 'https://commons.wikimedia.org/w/api.php?callback=?', {
            action : 'query',
            titles : 'File:'+value,
            format: 'json'
        })
        .done( function ( data ) {
            if ('-1' in data.query.pages ){
                report( pageid, 'error', 'File <i>'+value+'</i> does not exist on Commons', qid );
            } else {
                checkConstraints( pageid, qid, value );
            }
        });
    } else if ( job.datatype == 'time' ){
        var newvalue = parseDate( value );
        if ( newvalue !== false ){
             if ( isNaN( parseInt( job.calender.year ) ) ){
                 job.calender.year = 1926;
             }
             if (job.calender.rel == '=>'){
                  if ( parseInt( newvalue.substring(0,4) ) >= job.calender.year  ){
                       checkConstraints( pageid, qid, newvalue );
                  } else {
                       report( pageid, 'error', newvalue+' < '+job.calender.year, qid );
                  }
              } else {
                  if ( parseInt( newvalue.substring(0,4) ) <= job.calender.year  ){
                       checkConstraints( pageid, qid, newvalue );
                  } else {
                       report( pageid, 'error', newvalue+' > '+job.calender.year, qid );
                  }
              }
        } else {
             report( pageid, 'error', 'could not find a date', qid );
        }
    }
}

function parseTemplate( text, pageid, qid ){
    var result = '';
    text = text.replace( /(\r\n|\n|\r)/gm, '' ) //remove linebreaks
    text = text.replace( /<ref((?!<\/ref>).)*<\/ref>/g, '' ); //remove references
    text = text.replace( /<ref([^>]+)>/g, '' ); //remove reference tags
    text = text.replace( new RegExp( '{{\\s*'+job.templates, 'i' ), '{{'+job.template );
    var txt = text.split( '{{'+job.template );
    if ( txt.length == 1 ){
        report( pageid, 'error', 'Template not found', qid );
        return false;
    }
    text = txt[1];
    var patt = new RegExp( '{{((?!}}|{{).)*}}' );
    while ( true ){
        if ( patt.test( text ) ){
            text = text.replace( patt, '' ); //remove all other templates
        } else {
             break;
        }
    }
    txt = text.split( '}}' );
    text = txt[0];
    text = text.replace( /\|((?!\]\]|\||\[\[).)*\]\]/g, '\]\]' ); //simplify links
    parts = text.split( '|' );
    var unnamed = [];
    $.each( parts, function( i, m ){
       if (m.indexOf('=') != '-1'){
            sp = m.split('=');
            if (sp[0].toLowerCase().trim() == job.parameter.toLowerCase()){
                result = sp.slice(1).join( '=' ).trim();
            }
        } else {
           unnamed.push( m.trim() );
        }
   });
   if ( result === '' && !isNaN( job.parameter ) ){
        if ( unnamed.length > job.parameter ){
            result = unnamed[job.parameter];
        }
   }
    if ( result !== '' ){
        if ( job.demo != 1 ){
            delay = 5000;
        }
        handleValue( pageid, qid, result );
    } else {
        report( pageid, 'error', 'no value', qid );
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
            $.getJSON( 'https://'+job.siteid+'.'+job.project+'.org/w/api.php?callback=?', {
                action : 'query',
                prop : 'revisions',
                pageids : el.attr('id'),
                rvprop: 'content',
                format: 'json'
            })
            .done( function( data2 ) {
                parseTemplate( data2.query.pages[el.attr('id')].revisions[0]['*'], el.attr('id'), el.attr('data-qid') );
                proceedOnePage();
            });
        }, delay );
    } else {
        proceedOnePage();
    }
}

function createCheckboxlist( pageids ){
    for ( var j in pageids ){
        $('#result').append( '<div><input type="checkbox" name="pagelist" id="'+pageids[j][0]+'" data-qid="'+pageids[j][1]+'" checked><span><a href="//'+job.siteid+'.'+job.project+'.org/wiki/'+pageids[j][2]+'" target="_blank">'+pageids[j][2].replace( /_/g, ' ' )+'</a></span></div>' );
    }
    $('#addvalues').show();
    $('#demo').show();
    reportStatus(pageids.length == 1 ? 'Found one page' : 'Found '+pageids.length+' pages');
}

function getPages() {
    $.getJSON( 'getcandidates.php?', {
        dbname : job.dbname,
        template : job.template,
        category : job.category,
        p: job.p
    })
    .done( function( pageids ) {
        reportStatus( 'loading....' );
        $.getJSON( 'https://'+job.siteid+'.'+job.project+'.org/w/api.php?callback=?', {
            action : 'query',
            prop : 'redirects',
            titles : 'Template:'+job.template,
            rdnamespace: 10,
            format: 'json'
        })
        .done( function( data ) {
            job.templates = '('+job.template+'|'+job.template.replace( / /g, '_' );
            for ( var m in data.query.pages ){
                if ('redirects' in data.query.pages[m]){
                    for (var red in data.query.pages[m].redirects){
                        var title = data.query.pages[m].redirects[red].title.split(':',2);
                        job.templates += '|'+title[1]+'|'+title[1].replace( / /g, '_' );
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
        $( '#wikisyntax' ).hide();
        $( '#prefix' ).hide();
        $( '#calender' ).hide();
        $.getJSON( 'https://www.wikidata.org/w/api.php?callback=?',{
            action : 'wbgetentities',
            ids : 'P'+$( 'input[name="property"]' ).val(),
            format: 'json'
        },function( data ) {
            if ( data.entities['P'+$( 'input[name="property"]' ).val()].datatype == 'wikibase-item' ){
                $( '#wikisyntax' ).show();
            } else if ( data.entities['P'+$( 'input[name="property"]' ).val()].datatype == 'string' ){
                $( '#prefix' ).show();
            } else if ( data.entities['P'+$( 'input[name="property"]' ).val()].datatype == 'time' ){
                $( '#calender' ).show();
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
                    $('#demo').hide();
                    stopJob();
                    i = 0;
                    job = {
                        p: 'P'+$('input[name="property"]').val(),
                        siteid: $('input[name="siteid"]').val(),
                        project: $('input[name="project"]').val(),
                        template: $('input[name="template"]').val().capitalizeFirstLetter().replace( /_/g, ' ' ),
                        parameter: $('input[name="parameter"]').val(),
                        category: $('input[name="category"]').val(),
                        wikisyntax: $('input[name="wikisyntax"]').prop('checked'),
                        prefix: $('input[name="prefix"]').val(),
                        calender: {
                            model: $('select[name="calender"]').val(),
                            rel: $('select[name="rel"]').val(),
                            year: $('input[name="year"]').val()
                        }
                    };
                    if ( job.siteid === '' ){
                        $( 'input[name="siteid"]' ).addClass( 'error' );
                        error = 1;
                    }
                    if ( job.project === '' || $.inArray(job.project, allProjects) == -1 ){
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
                        job.siteid = getSiteid( job.siteid, job.project );
                        job.lang = getLanguage( job.siteid, job.project );
                        job.dbname = getDbname( job.siteid, job.project );
                        job.wbeditionid = getWpEditionId( job.dbname );
                        $.getJSON('https://www.wikidata.org/w/api.php?callback=?',{
                            action : 'wbgetentities',
                            ids : job.p,
                            format: 'json'
                        },function( data ) {
                            job.datatype = data.entities[job.p].datatype;
							// TODO: monolingualtext, quantity, geocoordinate
                            if ( job.datatype == 'string' || job.datatype == 'wikibase-item' || job.datatype == 'commonsMedia' || job.datatype == 'url' || job.datatype == 'time' ){
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
        } else if ( $(this).val() == 'demo' || $(this).val() == 'add values' ){
            if (job.demo == 1){
                $("#result").find('div').each(function(index, value) {
                    $(this).removeClass();
                    $(this).find('.value').html('');
                });
            }
            if ( $(this).val() == 'demo' ){
                job.demo = 1;
                $( '#addvalues' ).attr( 'disabled', true );
            } else {
                job.demo = 0;
                $( '#demo' ).attr( 'disabled', true );
            }
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