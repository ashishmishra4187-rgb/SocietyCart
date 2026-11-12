package com.societycart.common;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class FlatNumbersTest {

    private static List<String> sorted(String... flats) {
        List<String> list = new ArrayList<>(Arrays.asList(flats));
        list.sort(FlatNumbers.NATURAL);
        return list;
    }

    @Test
    @DisplayName("Numbers sort numerically, not as text: B-2 before B-10")
    void numericOrder() {
        assertEquals(List.of("B-2", "B-10", "B-101"), sorted("B-101", "B-10", "B-2"));
    }

    @Test
    @DisplayName("Blocks sort alphabetically first, then by number")
    void blocksThenNumbers() {
        assertEquals(List.of("A-1", "A-12", "B-3", "C-1"), sorted("C-1", "B-3", "A-12", "A-1"));
    }

    @Test
    @DisplayName("Case, padding zeros and surrounding spaces do not matter")
    void caseAndPadding() {
        assertEquals(0, FlatNumbers.compare("b-07", "B-7"));
        assertEquals(0, FlatNumbers.compare("  A 1", "A 1"));
        assertTrue(FlatNumbers.compare("a-2", "B-1") < 0);
    }

    @Test
    @DisplayName("Plain numeric flats and mixed formats are ordered sensibly")
    void plainNumbers() {
        assertEquals(List.of("9", "10", "101", "1204"), sorted("1204", "101", "9", "10"));
        assertEquals(List.of("12", "12A", "12B", "13"), sorted("13", "12B", "12", "12A"));
    }

    @Test
    @DisplayName("Null or empty flats sort first and never throw")
    void nullSafe() {
        assertEquals(List.of("", "A-1"), sorted("A-1", ""));
        assertTrue(FlatNumbers.compare(null, "A-1") < 0);
        assertEquals(0, FlatNumbers.compare(null, null));
    }

    @Test
    @DisplayName("Very long digit runs compare correctly without overflowing")
    void longNumbers() {
        assertTrue(FlatNumbers.compare("T-99999999999999999999", "T-100000000000000000000") < 0);
    }
}
