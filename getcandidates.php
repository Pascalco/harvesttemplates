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
ini_set( 'memory_limit', '4G' );
ini_set( 'max_execution_time', 0);

function getPagesWithTemplate( $template, $category){
    $ret = array();
    $ret2 = array();
    $template = ucfirst( trim( str_replace( ' ', '_', $template ) ) );
    if ( empty( $category )){
        $result = mysql_query( 'SELECT DISTINCT tl_from, page_title, pp_value FROM templatelinks, page, page_props WHERE tl_from_namespace=0 AND tl_namespace=10 AND tl_title = "'.$template.'" AND pp_propname = "wikibase_item" AND pp_page = tl_from AND page_id = tl_from' );
    } else {
        $category = trim( str_replace( ' ', '_', $category ) );
        $result = mysql_query( 'SELECT DISTINCT tl_from, page_title, pp_value FROM templatelinks, page, page_props WHERE tl_from_namespace=0 AND tl_namespace=10 AND tl_title = "'.$template.'" AND pp_propname = "wikibase_item" AND pp_page = tl_from AND page_id = tl_from AND tl_from IN (SELECT DISTINCT cl_from FROM categorylinks WHERE cl_to = "'.$category.'")');
    }
    while ( $row = mysql_fetch_assoc( $result ) ){
        $ret[$row['tl_from']] = $row['pp_value'];
        $ret2[$row['tl_from']] = $row['page_title'];
    }
    return array( $ret, $ret2 );
}

function getPagesWithClaim( $p, $offset ){
     $ret = array();
     $query = "PREFIX wdt: <http://www.wikidata.org/prop/direct/>SELECT ?item WHERE {?item wdt:".$p." ?value .} LIMIT 500000 OFFSET ".$offset;
     $url = 'https://query.wikidata.org/bigdata/namespace/wdq/sparql?'
           .'query='.urlencode( $query )
           .'&format=json';
     $ch = curl_init();
     curl_setopt( $ch, CURLOPT_SSL_VERIFYPEER, false );
     curl_setopt( $ch, CURLOPT_RETURNTRANSFER, true );
     curl_setopt( $ch, CURLOPT_URL, $url );
     $data = json_decode( curl_exec( $ch ), true );
     foreach( $data['results']['bindings'] as $item ){
         $ret[] = str_replace( 'http://www.wikidata.org/entity/', '', $item['item']['value'] );
     }
     curl_close( $ch );
     unset( $data );
     return $ret;
}

function openDB( $dbname ){
    $server = $dbname . '.labsdb';

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
$r = getPagesWithTemplate( $_GET['template'], $_GET['category'] );
mysql_close( $conn );


$single = array();
do{
    $single = array_merge( $single, getPagesWithClaim( $_GET['p'], count( $single ) ) );
} while (count($single) % 500000 == 0 && count($single) != 0);

$r[0] = array_diff( $r[0], $single );
$r[1] = array_intersect_key( $r[1], $r[0] );

echo json_encode( array_map( null, array_keys( $r[0] ), array_values( $r[0] ), array_values( $r[1] ) ) );
?>
