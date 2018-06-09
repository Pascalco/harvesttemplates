<?php
/**
 * To the extent possible under law, the author(s) have dedicated all copyright
 * and related and neighboring rights to this software to the public domain
 * worldwide. This software is distributed without any warranty.
 *
 * See <http://creativecommons.org/publicdomain/zero/1.0/> for a copy of the
 * CC0 Public Domain Dedication.
**/

header( 'Content-Type: application/json' );
ini_set( 'memory_limit', '4G' );
ini_set( 'max_execution_time', 0);

function getSubcats( &$cats, $root, $depth ){
    $c = array();
    foreach ( $root as $r ){
        if ( isset ( $cats[$r] ) ) continue;
        $cats[] = $r;
        $c[] = $r;
    }
    if ( $depth == 0) return;
    if ( count( $c ) == 0) return;
    $result = mysql_query( 'SELECT DISTINCT page_title FROM page, categorylinks WHERE page_id=cl_from AND cl_to IN ("'.implode('","', $c).'") AND cl_type="subcat"');
    $res = array();
    while( $row = mysql_fetch_assoc( $result ) ){
        $res[] = mysql_real_escape_string($row['page_title']);
    }
    getSubcats( $cats, $res, $depth - 1 );
}
function getPagesWithTemplate( $template, $cats, $namespace){
    $ret = array();
    $ret2 = array();
    $template = mysql_real_escape_string( ucfirst( trim( str_replace( ' ', '_', $template ) ) ) );
    if ( count( $cats ) == 0){
        $result = mysql_query( 'SELECT DISTINCT tl_from, page_title, pp_value FROM templatelinks, page, page_props WHERE tl_from_namespace='.$namespace.' AND tl_namespace=10 AND tl_title = "'.$template.'" AND pp_propname = "wikibase_item" AND pp_page = tl_from AND page_id = tl_from ORDER BY page_latest DESC' );
    } else {
        $result = mysql_query( 'SELECT DISTINCT tl_from, page_title, pp_value FROM templatelinks, page, page_props WHERE tl_from_namespace='.$namespace.' AND tl_namespace=10 AND tl_title = "'.$template.'" AND pp_propname = "wikibase_item" AND pp_page = tl_from AND page_id = tl_from AND tl_from IN (SELECT DISTINCT cl_from FROM categorylinks WHERE cl_to IN ("'.implode('","', $cats).'") )  ORDER BY page_latest DESC' );
    }
    while ( $row = mysql_fetch_assoc( $result ) ){
        $ret[$row['tl_from']] = $row['pp_value'];
        $ret2[$row['tl_from']] = $row['page_title'];
    }
    return array( $ret, $ret2 );
}


function getPagesWithoutClaim( $p, $r ){
    $prevlist = implode('","', $r);
    $ret = array();

    $result = mysql_query( 'SELECT DISTINCT page_title FROM page WHERE page_namespace=0 AND page_title IN ("' . $prevlist . '") AND NOT EXISTS (SELECT * FROM pagelinks WHERE pl_from=page_id AND pl_namespace=120 AND pl_title = "' . $p . '")' );

    while ( $row = mysql_fetch_assoc( $result ) ){
        array_push($ret, $row['page_title']);
    }
    return $ret;
}


function openDB( $dbname ){
    $server = $dbname . '.web.db.svc.eqiad.wmflabs';

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
    mysql_select_db( $dbname.'_p', $conn );
    return $conn;
}

if ( empty( $_GET['dbname'] ) or empty( $_GET['template'] ) or empty( $_GET['p'] ) ){
    exit(0);
}

$conn = openDB( $_GET['dbname'] );
$cats = array();
if ( !empty( $_GET['category'] ) ){
    $depth = (!empty( $_GET['depth'] ) ? $_GET['depth'] : 0);
    $root = array( mysql_real_escape_string( trim( str_replace( ' ', '_', $_GET['category'] ) ) ) );
    getSubcats( $cats, $root, $depth );
}
$r = getPagesWithTemplate( $_GET['template'], $cats, $_GET['namespace'] );
mysql_close( $conn );

if ( $_GET['set'] == '1' ){
    $conn = openDB( 'wikidatawiki' );
    $without = getPagesWithoutClaim( $_GET['p'], $r[0] );
    $r[0] = array_intersect( $r[0], $without );
    $r[1] = array_intersect_key( $r[1], $r[0] );
    mysql_close( $conn );
}

#return an array of arrays (pageid, Qid, page title)
echo json_encode( array_slice( array_map( null, array_keys( $r[0] ), array_values( $r[0] ), array_values( $r[1] ) ), $_GET['offset'], $_GET['limit'] ) );
?>
