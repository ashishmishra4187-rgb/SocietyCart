package com.societycart.common;

import java.util.Comparator;

/** Natural ordering for flat numbers, so "B-2" comes before "B-10" (plain string order gets this wrong). */
public final class FlatNumbers {

    private FlatNumbers() {
    }

    public static final Comparator<String> NATURAL = FlatNumbers::compare;

    public static int compare(String a, String b) {
        String x = a == null ? "" : a.trim().toUpperCase();
        String y = b == null ? "" : b.trim().toUpperCase();
        int i = 0;
        int j = 0;
        while (i < x.length() && j < y.length()) {
            char cx = x.charAt(i);
            char cy = y.charAt(j);
            if (Character.isDigit(cx) && Character.isDigit(cy)) {
                int si = i;
                int sj = j;
                while (i < x.length() && Character.isDigit(x.charAt(i))) i++;
                while (j < y.length() && Character.isDigit(y.charAt(j))) j++;
                String nx = x.substring(si, i).replaceFirst("^0+(?!$)", "");
                String ny = y.substring(sj, j).replaceFirst("^0+(?!$)", "");
                if (nx.length() != ny.length()) {
                    return Integer.compare(nx.length(), ny.length());
                }
                int c = nx.compareTo(ny);
                if (c != 0) {
                    return c;
                }
            } else {
                if (cx != cy) {
                    return Character.compare(cx, cy);
                }
                i++;
                j++;
            }
        }
        return Integer.compare(x.length() - i, y.length() - j);
    }
}
