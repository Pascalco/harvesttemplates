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

$url = 'https://www.wikidata.org/w/api.php?';
$data = array('action' => 'wbgetentities', 'ids' => $_GET['p'], 'props' => 'claims', 'format' => 'json');
foreach( $data as $k => $v ){
    $v2 = str_replace( ' ', '%20', $v );
    $url .= "$k=$v2&";
}
$curl = curl_init();
curl_setopt_array( $curl, array(
    CURLOPT_RETURNTRANSFER => 1,
    CURLOPT_URL => $url
));
$data = json_decode( curl_exec( $curl ) );
curl_close( $curl );


$con = array();

if (array_key_exists('P2302', $data->entities->$_GET['p']->claims)){
    foreach( $data->entities->$_GET['p']->claims->P2302 as $claim ){
        $type = $claim->mainsnak->datavalue->value->id;
        switch($type){
            case 'Q21502404': # format
                if (array_key_exists('qualifiers', $claim)){
                    if (array_key_exists('P1793', $claim->qualifiers)){
                        $value = $claim->qualifiers->P1793[0]->datavalue->value;
                        if (substr($value,0,4) == '(?i)'){
                            $con[] = array('type' => 'Format', 'modifier' => 'i', 'pattern' => substr($value, 4));
                        } else {
                            $con[] = array('type' => 'Format', 'pattern' => $value);
                        }
                    }
                }
                break;
            case 'Q21510852': # commons link
                if (array_key_exists('qualifiers', $claim)){
                    if (array_key_exists('P2307', $claim->qualifiers)){
                        $con[] = array('type' => 'Commons link', 'namespace' => $claim->qualifiers->P2307[0]->datavalue->value);
                    }
                }
                break;
            case 'Q21502838': # conflicts with
                if (array_key_exists('qualifiers', $claim)){
                    if (array_key_exists('P2305', $claim->qualifiers) and array_key_exists('P2306', $claim->qualifiers)){
                        $list =  array();
                        foreach( $claim->qualifiers->P2305 as $el ){
                            $list[] = $el->datavalue->value->id;
                        }
                        $con[] = array('type' => 'Conflicts with', 'list' => array($claim->qualifiers->P2306[0]->datavalue->value->id => $list));
                    }
                }
                break;
            case 'Q21510859': # one-of
                if (array_key_exists('qualifiers', $claim)){
                    if (array_key_exists('P2305', $claim->qualifiers)){
                        $list =  array();
                        foreach( $claim->qualifiers->P2305 as $el ){
                            $list[] = $el->datavalue->value->id;
                        }
                        $con[] = array('type' => 'One of', 'values' => $list);
                    }
                }
                break;
            case 'Q21503250': # type
                if (array_key_exists('qualifiers', $claim)){
                    if (array_key_exists('P2308', $claim->qualifiers) and array_key_exists('P2309', $claim->qualifiers)){
                        $list =  array();
                        foreach( $claim->qualifiers->P2308 as $el ){
                            $list[] = $el->datavalue->value->id;
                        }
                        if ($claim->qualifiers->P2309[0]->datavalue->value->id == 'Q21503252'){
                            $relation = 'P31';
                        } else {
                            $relation = 'P279';
                        }
                        $con[] = array('type' => 'Type', 'class' => $list, 'relation' => $relation);
                    }
                }
                break;
            case 'Q21510865': # value type
                if (array_key_exists('qualifiers', $claim)){
                    if (array_key_exists('P2308', $claim->qualifiers) and array_key_exists('P2309', $claim->qualifiers)){
                        $list =  array();
                        foreach( $claim->qualifiers->P2308 as $el ){
                            $list[] = $el->datavalue->value->id;
                        }
                        if ($claim->qualifiers->P2309[0]->datavalue->value->id == 'Q21503252'){
                            $relation = 'P31';
                        } else {
                            $relation = 'P279';
                        }
                        $con[] = array('type' => 'Value type', 'class' => $list, 'relation' => $relation);
                    }
                }
                break;
            case 'Q21510860': # range
                if (array_key_exists('qualifiers', $claim)){
                    if (array_key_exists('P2310', $claim->qualifiers)){
                        if ($claim->qualifiers->P2310[0]->snaktype == 'value'){
                            $min = $claim->qualifiers->P2310[0]->datavalue->value->time;
                        } else if ($claim->qualifiers->P2310[0]->snaktype == 'somevalue'){
                            $min = date('Y-m-d').'T00:00:00Z';
                        } else {
                            $min = '';
                        }
                    } else if (array_key_exists('P2313', $claim->qualifiers)){
                        if ($claim->qualifiers->P2313[0]->snaktype == 'value'){
                            $min = $claim->qualifiers->P2313[0]->datavalue->value->amount;
                        } else {
                            $min = '';
                        }
                    }
                    if (array_key_exists('P2311', $claim->qualifiers)){
                        if ($claim->qualifiers->P2311[0]->snaktype == 'value'){
                            $max = $claim->qualifiers->P2311[0]->datavalue->value->time;
                        } else if ($claim->qualifiers->P2311[0]->snaktype == 'somevalue'){
                            $max = date('Y-m-d').'T00:00:00Z';
                        } else {
                            $max = '';
                        }
                    } else if (array_key_exists('P2312', $claim->qualifiers)){
                        if ($claim->qualifiers->P2312[0]->snaktype == 'value'){
                            $max = $claim->qualifiers->P2312[0]->datavalue->value->amount;
                        } else {
                            $max = '';
                        }
                    }
                    $con[] = array('type' => 'Range', 'min' => $min, 'max' => $max);
                }
                break;
            case 'Q21502410': # unique value
                $con[] = array('type' => 'Unique value');
                break;
            case 'Q21510856': # mandatory qualifier
                $con = array(array('type' => 'Mandatory qualifier'));
                break 2;
            case 'Q21510863': # used as qualifier
                $con = array(array('type'=> 'Qualifier'));
                break 2;
            case 'Q21528959': # used as reference
                $con = array(array('type'=> 'Source'));
                break 2;
        }
    }
}

echo json_encode( $con );
?>
