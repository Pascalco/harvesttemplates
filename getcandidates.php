<?php
/**
 * To the extent possible under law, the author(s) have dedicated all copyright
 * and related and neighboring rights to this software to the public domain
 * worldwide. This software is distributed without any warranty.
 *
 * See <http://creativecommons.org/publicdomain/zero/1.0/> for a copy of the
 * CC0 Public Domain Dedication.
**/

header('Content-Type: application/json');

function getDBname ( $lang, $project ){
    $lang = strtolower($lang);
    $project = strtolower($project);
    $dbname = $lang;
    if ( $lang == 'commons' || $project == 'commons' ) $dbname = 'commonswiki_p';
    elseif ( $lang == 'wikidata' || $project == 'wikidata' ) $dbname = 'wikidatawiki_p';
    elseif ( $project == 'wikipedia' ) $dbname .= 'wiki_p';
    elseif ( $project == 'wikisource' ) $dbname .= 'wikisource_p';
    elseif ( $project == 'wiktionary' ) $dbname .= 'wiktionary_p';
    elseif ( $project == 'wikibooks' ) $dbname .= 'wikibooks_p';
    elseif ( $project == 'wikinews' ) $dbname .= 'wikinews_p';
    elseif ( $project == 'wikivoyage' ) $dbname .= 'wikivoyage_p';
    elseif ( $project == 'wikiquote' ) $dbname .= 'wikiquote_p';
    else $dbname = '';
    return $dbname;
}

function getPagesWithTemplate( $template, $namespace = 0 ){
    $ret = array();
    $ret2 = array();
    $template = ucfirst( trim( str_replace( ' ', '_', $template ) ) );
    $result = mysql_query( 'SELECT DISTINCT tl_from, page_title, pp_value FROM templatelinks, page, page_props WHERE tl_from_namespace='.$namespace.' AND tl_namespace=10 AND tl_title = "'.$template.'" AND pp_propname = "wikibase_item" AND pp_page = tl_from AND page_id = tl_from' );
    while ( $row = mysql_fetch_assoc( $result ) ){
        $ret[$row['tl_from']] = $row['pp_value'];
        $ret2[$row['tl_from']] = $row['page_title'];
    }
    return array( $ret, $ret2 );
}

function getPagesInCategory( $category, $namespace = 0 ){
    $ret = array();
    $category = trim( str_replace( ' ', '_', $category ) );
    $result = mysql_query( 'SELECT DISTINCT cl_from FROM categorylinks WHERE cl_to = "'.$category.'"' );
    while ( $row = mysql_fetch_assoc( $result ) ){
        $ret[$row['cl_from']] = 0;
    }
    return $ret;
}

function getPagesWithClaim( $p, $namespace = 0){
    ini_set( 'memory_limit', '1G' );
    $ret = array();
    $result = mysql_query( 'SELECT DISTINCT page_title FROM page, pagelinks WHERE page_id=pl_from AND pl_title = "'.$p.'" AND pl_from_namespace=0 AND pl_namespace=120' );
    while ( $row = mysql_fetch_assoc( $result ) ){
        $ret[] = $row['page_title'];
    }
    return $ret;
}


function openDB( $lang, $project ){
    $dbname = getDBname( $lang, $project );
    $server = substr( $dbname, 0, -2) . '.labsdb';

    $file = '/data/project/pltools/replica.my.cnf';

    $config = file_get_contents( $file );
    $lines = explode( "\n", $config );

    foreach( $lines as $line ){
        if ( strpos( $line, '=' ) == false ) continue;
        $foo = explode( '=', $line );
        $foo[1] = trim(str_replace( "'", "", $foo[1] ));
        if ( trim( $foo[0] ) == 'user' ) $username = $foo[1];
        if ( trim( $foo[0] ) == 'password' ) $password = $foo[1];
    }
    $conn =  mysql_connect( $server, $username, $password ) OR die(mysql_error());
    mysql_select_db( $dbname, $conn );
    return $conn;
}

if ( empty( $_GET['lang'] ) or empty( $_GET['project'] ) or empty( $_GET['p'] ) ){
    exit(0);
}

$conn = openDB( $_GET['lang'], $_GET['project'] );
$r = getPagesWithTemplate( $_GET['template'], 0 );
if ( !empty( $_GET['category'] ) ){
    $r[0] = array_intersect_key( $r[0], getPagesInCategory( $_GET['category'] ) );
}
mysql_close( $conn );
if ( !empty( $_GET['p'] ) ){
    $conn = openDB( 'Wikidata', 'Wikidata' );
    $single = getPagesWithClaim( $_GET['p'] );
    mysql_close( $conn );
    $r[0] = array_diff( $r[0], $single );
}
$r[1] = array_intersect_key( $r[1], $r[0] );

echo json_encode( array_map( null, array_keys( $r[0] ), array_values( $r[0] ), array_values( $r[1] ) ) );
?>
